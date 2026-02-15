from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from beanie.odm.operators.find.comparison import In

from src.db.models.chat_room import ChatRoom
from src.db.models.commute import Commute
from src.db.models.match_suggestion import (
    MatchPoint,
    MatchScores,
    MatchSuggestion,
    ParticipantDecision,
)
from src.db.models.user import User
from src.matching.algorithm import (
    MatchCandidate,
    MatchKind,
    MatchingCommute,
    MatchingUser,
    run_matching_algorithm,
)
from src.matching.geospatial import haversine_meters
from src.matching.settings import MATCHING_SETTINGS


async def _remove_from_queue_for_participants(participants: list[str]) -> None:
    commutes = await Commute.find(In(Commute.user_auth0_id, participants)).to_list()
    if not commutes:
        return
    now = datetime.now(timezone.utc)
    for commute in commutes:
        commute.enable_queue_flow = False
        commute.status = "paused"
        commute.updated_at = now
        await commute.save()


def _flatten_route_coordinates(commute: Commute) -> list[tuple[float, float]]:
    if commute.route_coordinates:
        return commute.route_coordinates
    flattened: list[tuple[float, float]] = []
    for segment in commute.route_segments:
        flattened.extend(segment.coordinates)
    return flattened


def _to_algorithm_commute(commute: Commute) -> MatchingCommute:
    return MatchingCommute(
        user_auth0_id=commute.user_auth0_id,
        transport_mode=commute.transport_mode,
        match_preference=commute.match_preference,
        group_size_min=commute.group_size_pref.min,
        group_size_max=commute.group_size_pref.max,
        gender_preference=commute.gender_preference,
        start_minute=commute.time_window.start_minute,
        end_minute=commute.time_window.end_minute,
        route_coordinates=_flatten_route_coordinates(commute),
    )


def _to_algorithm_user(user: User) -> MatchingUser:
    return MatchingUser(
        auth0_id=user.auth0_id,
        gender=user.gender,
        interests=user.interests,
    )


def _segment_destination_name(label: str | None) -> str | None:
    if not isinstance(label, str):
        return None
    text = label.strip()
    if not text:
        return None
    lower_text = text.lower()
    if lower_text == "walk segment":
        return None
    marker = " to "
    marker_index = lower_text.rfind(marker)
    if marker_index == -1:
        return None
    destination = text[marker_index + len(marker) :].strip()
    return destination or None


def _named_points_for_commute(commute: Commute) -> list[tuple[str, tuple[float, float]]]:
    points: list[tuple[str, tuple[float, float]]] = [
        (commute.start.name, (commute.start.lat, commute.start.lng)),
        (commute.end.name, (commute.end.lat, commute.end.lng)),
    ]
    for segment in commute.route_segments:
        destination_name = _segment_destination_name(segment.label)
        if not destination_name or not segment.coordinates:
            continue
        destination_coordinate = segment.coordinates[-1]
        points.append((destination_name, (destination_coordinate[0], destination_coordinate[1])))
    return points


def _nearest_point_name(
    target: tuple[float, float],
    commutes: list[Commute],
    *,
    max_distance_meters: float = 400.0,
) -> str | None:
    best_name: str | None = None
    best_distance = float("inf")
    for commute in commutes:
        for name, point in _named_points_for_commute(commute):
            distance = haversine_meters(target, point)
            if distance < best_distance:
                best_distance = distance
                best_name = name
    if best_name is None or best_distance > max_distance_meters:
        return None
    return best_name


def _participant_commutes_for_candidate(
    candidate: MatchCandidate,
    commute_by_user_id: dict[str, Commute],
) -> list[Commute]:
    return [
        commute_by_user_id[user_id]
        for user_id in candidate.participants
        if user_id in commute_by_user_id
    ]


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _candidate_to_match_doc(
    candidate: MatchCandidate,
    source: Literal["suggested", "queue_assigned"],
    status: Literal["suggested", "assigned"],
    participant_commutes: list[Commute],
    commute_date: date | None = None,
) -> MatchSuggestion:
    now = datetime.now(timezone.utc)
    decisions = [ParticipantDecision(auth0_id=auth0_id) for auth0_id in candidate.participants]
    meet_target = (candidate.overlap.meet_point.lat, candidate.overlap.meet_point.lng)
    split_target = (candidate.overlap.split_point.lat, candidate.overlap.split_point.lng)
    meet_name = _nearest_point_name(meet_target, participant_commutes) or "Shared route start"
    split_name = _nearest_point_name(split_target, participant_commutes) or "Shared route end"
    return MatchSuggestion(
        source=source,
        kind=candidate.kind,
        status=status,
        participants=candidate.participants,
        transport_mode=candidate.transport_mode,
        scores=MatchScores(
            overlap_score=candidate.scores.overlap_score,
            interest_score=candidate.scores.interest_score,
            composite_score=candidate.scores.composite_score,
        ),
        compatibility_percent=round(candidate.scores.composite_score * 100),
        shared_segment_start=MatchPoint(
            name=meet_name,
            lat=candidate.overlap.meet_point.lat,
            lng=candidate.overlap.meet_point.lng,
        ),
        shared_segment_end=MatchPoint(
            name=split_name,
            lat=candidate.overlap.split_point.lat,
            lng=candidate.overlap.split_point.lng,
        ),
        estimated_time_minutes=candidate.estimated_shared_minutes,
        decisions=decisions,
        commute_date=commute_date,
        created_at=now,
        updated_at=now,
    )


async def _eligible_users_and_commutes(kind: MatchKind) -> tuple[list[User], list[Commute]]:
    suggestion_commutes = await Commute.find(
        Commute.enable_suggestions_flow == True,
        In(Commute.match_preference, [kind, "both"]),
    ).to_list()
    if not suggestion_commutes:
        return ([], [])

    user_ids = [commute.user_auth0_id for commute in suggestion_commutes]
    users = await User.find(In(User.auth0_id, user_ids)).to_list()
    users_by_id = {user.auth0_id: user for user in users}
    filtered_commutes = [commute for commute in suggestion_commutes if commute.user_auth0_id in users_by_id]
    return (list(users_by_id.values()), filtered_commutes)


async def run_suggestions_for_kind(kind: MatchKind) -> list[MatchSuggestion]:
    users, commutes = await _eligible_users_and_commutes(kind)
    if not users or len(commutes) < 2:
        return []

    active_users = set()
    active_matches = await MatchSuggestion.find(MatchSuggestion.status == "active").to_list()
    for match in active_matches:
        for user_id in match.participants:
            active_users.add(user_id)

    filtered_users = [user for user in users if user.auth0_id not in active_users]
    filtered_commutes = [commute for commute in commutes if commute.user_auth0_id not in active_users]
    if len(filtered_users) < 2 or len(filtered_commutes) < 2:
        return []

    candidates = run_matching_algorithm(
        users=[_to_algorithm_user(user) for user in filtered_users],
        commutes=[_to_algorithm_commute(commute) for commute in filtered_commutes],
        kind=kind,
        min_time_overlap_minutes=MATCHING_SETTINGS.algorithm.min_time_overlap_minutes,
        min_overlap_distance_meters=MATCHING_SETTINGS.algorithm.min_overlap_distance_meters,
        overlap_tolerance_meters=MATCHING_SETTINGS.algorithm.overlap_tolerance_meters,
        overlap_weight=MATCHING_SETTINGS.algorithm.overlap_weight,
        interest_weight=MATCHING_SETTINGS.algorithm.interest_weight,
        shared_meters_per_minute=MATCHING_SETTINGS.algorithm.shared_meters_per_minute,
    )

    created: list[MatchSuggestion] = []
    commute_by_user_id = {commute.user_auth0_id: commute for commute in filtered_commutes}
    existing_matches = await MatchSuggestion.find(
        MatchSuggestion.source == "suggested",
        MatchSuggestion.kind == kind,
    ).to_list()
    open_existing_matches = [
        match
        for match in existing_matches
        if match.status in {"suggested", "active"}
        and not (
            MATCHING_SETTINGS.service.pass_cooldown_days <= 0
            and match.status == "suggested"
            and any(decision.passed_at is not None for decision in match.decisions)
        )
    ]
    existing_count_by_user: dict[str, int] = {}
    for match in open_existing_matches:
        for user_id in match.participants:
            existing_count_by_user[user_id] = existing_count_by_user.get(user_id, 0) + 1

    def per_user_limit(user_id: str) -> int:
        if kind != "individual":
            return 1
        commute = commute_by_user_id.get(user_id)
        if not commute:
            return 1
        return 2 if commute.match_preference == "both" else 1

    for candidate in candidates:
        existing = next(
            (
                item
                for item in open_existing_matches
                if set(item.participants) == set(candidate.participants)
            ),
            None,
        )
        if existing:
            continue
        if any(existing_count_by_user.get(user_id, 0) >= per_user_limit(user_id) for user_id in candidate.participants):
            continue
        participant_commutes = _participant_commutes_for_candidate(candidate, commute_by_user_id)
        document = _candidate_to_match_doc(
            candidate=candidate,
            source="suggested",
            status="suggested",
            participant_commutes=participant_commutes,
        )
        await document.insert()
        for user_id in candidate.participants:
            existing_count_by_user[user_id] = existing_count_by_user.get(user_id, 0) + 1
        created.append(document)
    return created


async def run_queue_assignments_for_kind(kind: MatchKind, commute_date: date) -> list[MatchSuggestion]:
    queued_commutes = await Commute.find(
        Commute.status == "queued",
        Commute.enable_queue_flow == True,
        In(Commute.match_preference, [kind, "both"]),
    ).to_list()
    if not queued_commutes:
        return []

    user_ids = [commute.user_auth0_id for commute in queued_commutes]
    users = await User.find(In(User.auth0_id, user_ids)).to_list()
    if len(users) < 2:
        return []
    users_by_id = {user.auth0_id: user for user in users}
    commutes = [commute for commute in queued_commutes if commute.user_auth0_id in users_by_id]

    candidates = run_matching_algorithm(
        users=[_to_algorithm_user(user) for user in users_by_id.values()],
        commutes=[_to_algorithm_commute(commute) for commute in commutes],
        kind=kind,
        min_time_overlap_minutes=MATCHING_SETTINGS.algorithm.min_time_overlap_minutes,
        min_overlap_distance_meters=MATCHING_SETTINGS.algorithm.min_overlap_distance_meters,
        overlap_tolerance_meters=MATCHING_SETTINGS.algorithm.overlap_tolerance_meters,
        overlap_weight=MATCHING_SETTINGS.algorithm.overlap_weight,
        interest_weight=MATCHING_SETTINGS.algorithm.interest_weight,
        shared_meters_per_minute=MATCHING_SETTINGS.algorithm.shared_meters_per_minute,
    )
    commute_by_user_id = {commute.user_auth0_id: commute for commute in commutes}
    created: list[MatchSuggestion] = []
    now = datetime.now(timezone.utc)
    existing_queue_matches = await MatchSuggestion.find(
        MatchSuggestion.source == "queue_assigned",
        MatchSuggestion.commute_date == commute_date,
        MatchSuggestion.kind == kind,
    ).to_list()
    existing_suggested_matches = await MatchSuggestion.find(
        MatchSuggestion.source == "suggested",
        MatchSuggestion.kind == kind,
        In(MatchSuggestion.status, ["suggested", "active"]),
    ).to_list()
    existing_active_queue_matches = await MatchSuggestion.find(
        MatchSuggestion.source == "queue_assigned",
        MatchSuggestion.kind == kind,
        MatchSuggestion.status == "active",
    ).to_list()
    open_statuses = {"suggested", "assigned", "active"}
    queued_user_ids = {commute.user_auth0_id for commute in queued_commutes}
    consumed_users: set[str] = {
        user_id
        for match in [*existing_queue_matches, *existing_active_queue_matches]
        if match.status in open_statuses
        for user_id in match.participants
    }
    suggested_by_participants: dict[frozenset[str], MatchSuggestion] = {
        frozenset(match.participants): match
        for match in existing_suggested_matches
        if match.status in {"suggested", "active"}
    }

    promotable_suggestions = [
        match
        for match in existing_suggested_matches
        if match.status == "suggested"
        and all(user_id in queued_user_ids for user_id in match.participants)
    ]
    promotable_suggestions.sort(key=lambda item: item.scores.composite_score, reverse=True)
    for suggestion in promotable_suggestions:
        if any(user_id in consumed_users for user_id in suggestion.participants):
            continue
        for decision in suggestion.decisions:
            decision.accepted_at = now
            decision.passed_at = None
            decision.pass_cooldown_until = None
        if not suggestion.chat_room_id:
            room = ChatRoom(
                match_id=str(suggestion.id),
                participants=suggestion.participants,
                type="group" if len(suggestion.participants) > 2 else "dm",
            )
            await room.insert()
            suggestion.chat_room_id = str(room.id)
        suggestion.source = "queue_assigned"
        suggestion.status = "active"
        suggestion.commute_date = commute_date
        suggestion.updated_at = now
        await suggestion.save()
        await _remove_from_queue_for_participants(suggestion.participants)
        for user_id in suggestion.participants:
            consumed_users.add(user_id)
        created.append(suggestion)

    for candidate in candidates:
        participant_set = frozenset(candidate.participants)
        suggested_match = suggested_by_participants.get(participant_set)
        if suggested_match:
            for decision in suggested_match.decisions:
                decision.accepted_at = now
                decision.passed_at = None
                decision.pass_cooldown_until = None
            if not suggested_match.chat_room_id:
                room = ChatRoom(
                    match_id=str(suggested_match.id),
                    participants=suggested_match.participants,
                    type="group" if len(suggested_match.participants) > 2 else "dm",
                )
                await room.insert()
                suggested_match.chat_room_id = str(room.id)
            suggested_match.source = "queue_assigned"
            suggested_match.status = "active"
            suggested_match.commute_date = commute_date
            suggested_match.updated_at = now
            await suggested_match.save()
            await _remove_from_queue_for_participants(suggested_match.participants)
            for user_id in candidate.participants:
                consumed_users.add(user_id)
            created.append(suggested_match)
            continue

        if any(user_id in consumed_users for user_id in candidate.participants):
            continue
        existing = next(
            (
                match
                for match in existing_queue_matches
                if match.status in open_statuses
                and set(match.participants) == set(candidate.participants)
            ),
            None,
        )
        if existing:
            continue
        participant_commutes = _participant_commutes_for_candidate(candidate, commute_by_user_id)
        document = _candidate_to_match_doc(
            candidate=candidate,
            source="queue_assigned",
            status="assigned",
            participant_commutes=participant_commutes,
            commute_date=commute_date,
        )
        await document.insert()

        room = ChatRoom(
            match_id=str(document.id),
            participants=document.participants,
            type="group" if len(document.participants) > 2 else "dm",
        )
        await room.insert()
        document.chat_room_id = str(room.id)
        document.status = "active"
        document.updated_at = now
        await document.save()
        await _remove_from_queue_for_participants(document.participants)
        for user_id in candidate.participants:
            consumed_users.add(user_id)
        created.append(document)
    return created


async def list_suggestions_for_user(auth0_id: str, kind: MatchKind) -> list[MatchSuggestion]:
    now = datetime.now(timezone.utc)
    suggestions = await MatchSuggestion.find(
        MatchSuggestion.source == "suggested",
        MatchSuggestion.kind == kind,
        MatchSuggestion.status == "suggested",
    ).to_list()
    visible: list[MatchSuggestion] = []
    for suggestion in suggestions:
        if auth0_id not in suggestion.participants:
            continue
        decision = next((item for item in suggestion.decisions if item.auth0_id == auth0_id), None)
        if not decision:
            continue
        if (
            MATCHING_SETTINGS.service.pass_cooldown_days <= 0
            and decision.passed_at is not None
        ):
            continue
        cooldown_until = _as_aware_utc(decision.pass_cooldown_until)
        if cooldown_until and cooldown_until > now:
            continue
        if decision.accepted_at is not None:
            continue
        visible.append(suggestion)
    return visible


async def list_active_for_user(auth0_id: str, kind: MatchKind) -> list[MatchSuggestion]:
    matches = await MatchSuggestion.find(
        MatchSuggestion.kind == kind,
        MatchSuggestion.status == "active",
    ).to_list()
    return [match for match in matches if auth0_id in match.participants]


async def list_assignments_for_user(
    auth0_id: str,
    kind: MatchKind,
    commute_date: date,
) -> list[MatchSuggestion]:
    matches = await MatchSuggestion.find(
        MatchSuggestion.source == "queue_assigned",
        MatchSuggestion.kind == kind,
        MatchSuggestion.commute_date == commute_date,
    ).to_list()
    return [match for match in matches if auth0_id in match.participants]


async def accept_suggestion(auth0_id: str, suggestion_id: str) -> MatchSuggestion | None:
    suggestion = await MatchSuggestion.get(suggestion_id)
    if not suggestion or suggestion.source != "suggested":
        return None
    if auth0_id not in suggestion.participants:
        return None
    if suggestion.status != "suggested":
        return suggestion

    now = datetime.now(timezone.utc)
    for decision in suggestion.decisions:
        if decision.auth0_id == auth0_id:
            decision.accepted_at = now
            decision.passed_at = None
            decision.pass_cooldown_until = None

    all_accepted = all(decision.accepted_at is not None for decision in suggestion.decisions)
    if all_accepted:
        room = ChatRoom(
            match_id=str(suggestion.id),
            participants=suggestion.participants,
            type="group" if len(suggestion.participants) > 2 else "dm",
        )
        await room.insert()
        suggestion.chat_room_id = str(room.id)
        suggestion.status = "active"

    suggestion.updated_at = now
    await suggestion.save()
    return suggestion


async def pass_suggestion(auth0_id: str, suggestion_id: str) -> MatchSuggestion | None:
    suggestion = await MatchSuggestion.get(suggestion_id)
    if not suggestion or suggestion.source != "suggested":
        return None
    if auth0_id not in suggestion.participants:
        return None
    if suggestion.status != "suggested":
        return suggestion

    now = datetime.now(timezone.utc)
    cooldown_days = MATCHING_SETTINGS.service.pass_cooldown_days
    for decision in suggestion.decisions:
        if decision.auth0_id == auth0_id:
            decision.passed_at = now
            decision.accepted_at = None
            if cooldown_days > 0:
                decision.pass_cooldown_until = now + timedelta(days=cooldown_days)
            else:
                decision.pass_cooldown_until = now
    if cooldown_days <= 0:
        suggestion.status = "completed"
    suggestion.updated_at = now
    await suggestion.save()
    return suggestion


async def run_matching_cycle(run_queue: bool = False) -> dict[str, int]:
    created_individual = await run_suggestions_for_kind("individual")
    created_group = await run_suggestions_for_kind("group")

    assigned_individual: list[MatchSuggestion] = []
    assigned_group: list[MatchSuggestion] = []
    if run_queue:
        tomorrow = date.today() + timedelta(
            days=MATCHING_SETTINGS.service.queue_assignment_days_ahead
        )
        assigned_individual = await run_queue_assignments_for_kind("individual", tomorrow)
        assigned_group = await run_queue_assignments_for_kind("group", tomorrow)

    return {
        "suggestions_individual": len(created_individual),
        "suggestions_group": len(created_group),
        "assignments_individual": len(assigned_individual),
        "assignments_group": len(assigned_group),
    }

