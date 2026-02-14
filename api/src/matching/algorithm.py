from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import Literal

from src.matching.geospatial import (
    OverlapSegment,
    polyline_length_meters,
    route_overlap_segment,
)

MatchKind = Literal["individual", "group"]
TransportMode = Literal["walk", "transit"]
GenderPreference = Literal["any", "same"]


@dataclass(frozen=True)
class MatchingUser:
    auth0_id: str
    gender: str
    interests: list[str]


@dataclass(frozen=True)
class MatchingCommute:
    user_auth0_id: str
    transport_mode: TransportMode
    match_preference: MatchKind
    group_size_min: int
    group_size_max: int
    gender_preference: GenderPreference
    start_minute: int
    end_minute: int
    route_coordinates: list[tuple[float, float]]


@dataclass(frozen=True)
class PairScore:
    overlap_score: float
    interest_score: float
    composite_score: float


@dataclass(frozen=True)
class MatchCandidate:
    participants: list[str]
    kind: MatchKind
    transport_mode: TransportMode
    scores: PairScore
    overlap: OverlapSegment
    estimated_shared_minutes: int


@dataclass(frozen=True)
class _PairCompatibility:
    left_user_id: str
    right_user_id: str
    score: PairScore
    overlap: OverlapSegment
    transport_mode: TransportMode
    estimated_shared_minutes: int


def _normalized_gender(gender: str) -> str:
    return gender.strip().lower()


def _can_match_gender(
    left_user: MatchingUser,
    left_commute: MatchingCommute,
    right_user: MatchingUser,
    right_commute: MatchingCommute,
) -> bool:
    left_gender = _normalized_gender(left_user.gender)
    right_gender = _normalized_gender(right_user.gender)

    if left_commute.gender_preference == "same" and left_gender != right_gender:
        return False
    if right_commute.gender_preference == "same" and left_gender != right_gender:
        return False
    return True


def _window_overlap_minutes(left: MatchingCommute, right: MatchingCommute) -> int:
    start = max(left.start_minute, right.start_minute)
    end = min(left.end_minute, right.end_minute)
    return max(0, end - start)


def _interest_score(left: MatchingUser, right: MatchingUser) -> float:
    left_set = {interest.strip().lower() for interest in left.interests if interest.strip()}
    right_set = {interest.strip().lower() for interest in right.interests if interest.strip()}
    if not left_set and not right_set:
        return 0.0
    union = left_set | right_set
    intersection = left_set & right_set
    return len(intersection) / len(union) if union else 0.0


def _overlap_score(
    overlap_distance_meters: float,
    left_route: list[tuple[float, float]],
    right_route: list[tuple[float, float]],
) -> float:
    left_length = polyline_length_meters(left_route)
    right_length = polyline_length_meters(right_route)
    baseline = min(left_length, right_length)
    if baseline <= 0:
        return 0.0
    return min(1.0, overlap_distance_meters / baseline)


def _supports_group_size(commute: MatchingCommute, size: int) -> bool:
    return commute.group_size_min <= size <= commute.group_size_max


def _build_pair_compatibility(
    users_by_id: dict[str, MatchingUser],
    commutes_by_user_id: dict[str, MatchingCommute],
    min_time_overlap_minutes: int,
    min_overlap_distance_meters: float,
    overlap_tolerance_meters: float,
    overlap_weight: float,
    interest_weight: float,
    shared_meters_per_minute: float,
) -> list[_PairCompatibility]:
    compatibilities: list[_PairCompatibility] = []
    user_ids = list(users_by_id.keys())

    for left_user_id, right_user_id in combinations(user_ids, 2):
        left_user = users_by_id[left_user_id]
        right_user = users_by_id[right_user_id]
        left_commute = commutes_by_user_id[left_user_id]
        right_commute = commutes_by_user_id[right_user_id]

        if left_commute.transport_mode != right_commute.transport_mode:
            continue
        if _window_overlap_minutes(left_commute, right_commute) < min_time_overlap_minutes:
            continue
        if not _can_match_gender(left_user, left_commute, right_user, right_commute):
            continue

        overlap = route_overlap_segment(
            left_commute.route_coordinates,
            right_commute.route_coordinates,
            tolerance_meters=overlap_tolerance_meters,
        )
        if not overlap:
            continue
        if overlap.overlap_distance_meters < min_overlap_distance_meters:
            continue

        overlap_score = _overlap_score(
            overlap.overlap_distance_meters,
            left_commute.route_coordinates,
            right_commute.route_coordinates,
        )
        interest_score = _interest_score(left_user, right_user)
        composite = (overlap_weight * overlap_score) + (interest_weight * interest_score)
        score = PairScore(
            overlap_score=overlap_score,
            interest_score=interest_score,
            composite_score=composite,
        )

        meters_per_minute = max(1.0, shared_meters_per_minute)
        estimated_minutes = max(1, round(overlap.overlap_distance_meters / meters_per_minute))
        compatibilities.append(
            _PairCompatibility(
                left_user_id=left_user_id,
                right_user_id=right_user_id,
                score=score,
                overlap=overlap,
                transport_mode=left_commute.transport_mode,
                estimated_shared_minutes=estimated_minutes,
            )
        )
    return compatibilities


def _build_individual_matches(compatibilities: list[_PairCompatibility]) -> list[MatchCandidate]:
    sorted_pairs = sorted(
        compatibilities,
        key=lambda pair: (
            pair.score.composite_score,
            tuple(sorted((pair.left_user_id, pair.right_user_id))),
        ),
        reverse=True,
    )
    consumed_users: set[str] = set()
    selected: list[MatchCandidate] = []

    for pair in sorted_pairs:
        if pair.left_user_id in consumed_users or pair.right_user_id in consumed_users:
            continue
        consumed_users.add(pair.left_user_id)
        consumed_users.add(pair.right_user_id)
        selected.append(
            MatchCandidate(
                participants=[pair.left_user_id, pair.right_user_id],
                kind="individual",
                transport_mode=pair.transport_mode,
                scores=pair.score,
                overlap=pair.overlap,
                estimated_shared_minutes=pair.estimated_shared_minutes,
            )
        )
    return selected


def _is_clique(members: tuple[str, ...], pair_lookup: dict[frozenset[str], _PairCompatibility]) -> bool:
    for left_user_id, right_user_id in combinations(members, 2):
        if frozenset((left_user_id, right_user_id)) not in pair_lookup:
            return False
    return True


def _aggregate_group_score(
    members: tuple[str, ...],
    pair_lookup: dict[frozenset[str], _PairCompatibility],
) -> tuple[PairScore, OverlapSegment, TransportMode, int]:
    pair_scores: list[PairScore] = []
    pair_overlaps: list[OverlapSegment] = []
    estimated_minutes: list[int] = []
    mode: TransportMode | None = None

    for left_user_id, right_user_id in combinations(members, 2):
        pair = pair_lookup[frozenset((left_user_id, right_user_id))]
        pair_scores.append(pair.score)
        pair_overlaps.append(pair.overlap)
        estimated_minutes.append(pair.estimated_shared_minutes)
        mode = pair.transport_mode

    overlap_average = sum(score.overlap_score for score in pair_scores) / len(pair_scores)
    interest_average = sum(score.interest_score for score in pair_scores) / len(pair_scores)
    composite_average = sum(score.composite_score for score in pair_scores) / len(pair_scores)
    longest_overlap = max(pair_overlaps, key=lambda overlap: overlap.overlap_distance_meters)
    average_minutes = max(1, round(sum(estimated_minutes) / len(estimated_minutes)))

    return (
        PairScore(
            overlap_score=overlap_average,
            interest_score=interest_average,
            composite_score=composite_average,
        ),
        longest_overlap,
        mode or "walk",
        average_minutes,
    )


def _build_group_matches(
    compatibilities: list[_PairCompatibility],
    commutes_by_user_id: dict[str, MatchingCommute],
) -> list[MatchCandidate]:
    pair_lookup = {
        frozenset((pair.left_user_id, pair.right_user_id)): pair for pair in compatibilities
    }
    available_users = {
        commute.user_auth0_id
        for commute in commutes_by_user_id.values()
        if commute.match_preference == "group"
    }
    selected: list[MatchCandidate] = []

    while True:
        best_group: MatchCandidate | None = None
        best_members: tuple[str, ...] | None = None

        for target_size in (4, 3):
            if len(available_users) < target_size:
                continue
            for members in combinations(sorted(available_users), target_size):
                if not all(
                    _supports_group_size(commutes_by_user_id[member], target_size)
                    for member in members
                ):
                    continue
                if not _is_clique(members, pair_lookup):
                    continue
                score, overlap, mode, estimated_minutes = _aggregate_group_score(members, pair_lookup)
                candidate = MatchCandidate(
                    participants=list(members),
                    kind="group",
                    transport_mode=mode,
                    scores=score,
                    overlap=overlap,
                    estimated_shared_minutes=estimated_minutes,
                )
                if not best_group or candidate.scores.composite_score > best_group.scores.composite_score:
                    best_group = candidate
                    best_members = members

        if not best_group or not best_members:
            break

        selected.append(best_group)
        for member in best_members:
            available_users.discard(member)

    return selected


def run_matching_algorithm(
    users: list[MatchingUser],
    commutes: list[MatchingCommute],
    kind: MatchKind,
    *,
    min_time_overlap_minutes: int = 10,
    min_overlap_distance_meters: float = 250.0,
    overlap_tolerance_meters: float = 120.0,
    overlap_weight: float = 0.7,
    interest_weight: float = 0.3,
    shared_meters_per_minute: float = 80.0,
) -> list[MatchCandidate]:
    users_by_id = {user.auth0_id: user for user in users}
    commutes_by_user_id = {commute.user_auth0_id: commute for commute in commutes}

    eligible_user_ids = [
        user.auth0_id
        for user in users
        if user.auth0_id in commutes_by_user_id
        and commutes_by_user_id[user.auth0_id].match_preference == kind
    ]
    filtered_users = {user_id: users_by_id[user_id] for user_id in eligible_user_ids}
    filtered_commutes = {user_id: commutes_by_user_id[user_id] for user_id in eligible_user_ids}
    if len(filtered_users) < 2:
        return []

    pair_compatibilities = _build_pair_compatibility(
        users_by_id=filtered_users,
        commutes_by_user_id=filtered_commutes,
        min_time_overlap_minutes=min_time_overlap_minutes,
        min_overlap_distance_meters=min_overlap_distance_meters,
        overlap_tolerance_meters=overlap_tolerance_meters,
        overlap_weight=overlap_weight,
        interest_weight=interest_weight,
        shared_meters_per_minute=shared_meters_per_minute,
    )
    if not pair_compatibilities:
        return []

    if kind == "individual":
        return _build_individual_matches(pair_compatibilities)
    return _build_group_matches(pair_compatibilities, filtered_commutes)

