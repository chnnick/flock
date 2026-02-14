from typing import Literal

from src.matching.algorithm import MatchingCommute, MatchingUser, run_matching_algorithm
from src.matching.settings import load_matching_settings

MATCHING_SETTINGS = load_matching_settings()


def _run_with_yaml(
    users: list[MatchingUser],
    commutes: list[MatchingCommute],
    kind: Literal["individual", "group"],
):
    return run_matching_algorithm(
        users=users,
        commutes=commutes,
        kind=kind,
        min_time_overlap_minutes=MATCHING_SETTINGS.algorithm.min_time_overlap_minutes,
        min_overlap_distance_meters=MATCHING_SETTINGS.algorithm.min_overlap_distance_meters,
        overlap_tolerance_meters=MATCHING_SETTINGS.algorithm.overlap_tolerance_meters,
        overlap_weight=MATCHING_SETTINGS.algorithm.overlap_weight,
        interest_weight=MATCHING_SETTINGS.algorithm.interest_weight,
        shared_meters_per_minute=MATCHING_SETTINGS.algorithm.shared_meters_per_minute,
    )


def _build_user(auth0_id: str, gender: str, interests: list[str]) -> MatchingUser:
    return MatchingUser(auth0_id=auth0_id, gender=gender, interests=interests)


def _build_commute(
    auth0_id: str,
    preference: Literal["individual", "group"] = "individual",
    group_min: int = 2,
    group_max: int = 2,
    gender_pref: Literal["any", "same"] = "any",
    start: int = 8 * 60,
    end: int = 9 * 60,
    mode: Literal["walk", "transit"] = "walk",
    route: list[tuple[float, float]] | None = None,
) -> MatchingCommute:
    return MatchingCommute(
        user_auth0_id=auth0_id,
        transport_mode=mode,
        match_preference=preference,
        group_size_min=group_min,
        group_size_max=group_max,
        gender_preference=gender_pref,
        start_minute=start,
        end_minute=end,
        route_coordinates=route
        or [
            (37.7749, -122.4194),
            (37.7760, -122.4180),
            (37.7770, -122.4170),
            (37.7780, -122.4160),
        ],
    )


def test_individual_matching_respects_hard_constraints() -> None:
    users = [
        _build_user("u1", "women", ["music", "coffee", "hiking"]),
        _build_user("u2", "women", ["coffee", "movies", "reading"]),
        _build_user("u3", "men", ["coffee", "running", "music"]),
    ]
    commutes = [
        _build_commute("u1", gender_pref="same"),
        _build_commute("u2", gender_pref="any"),
        _build_commute(
            "u3",
            gender_pref="any",
            route=[
                (37.8044, -122.2712),
                (37.8055, -122.2700),
                (37.8064, -122.2691),
                (37.8072, -122.2680),
            ],
        ),
    ]

    results = _run_with_yaml(users, commutes, kind="individual")

    assert len(results) == 1
    assert set(results[0].participants) == {"u1", "u2"}
    assert results[0].scores.composite_score > 0


def test_group_matching_builds_clique_of_three() -> None:
    users = [
        _build_user("u1", "women", ["music", "coffee", "hiking"]),
        _build_user("u2", "women", ["coffee", "movies", "reading"]),
        _build_user("u3", "women", ["music", "running", "coffee"]),
    ]
    commutes = [
        _build_commute("u1", preference="group", group_min=3, group_max=4),
        _build_commute("u2", preference="group", group_min=3, group_max=4),
        _build_commute("u3", preference="group", group_min=3, group_max=4),
    ]

    results = _run_with_yaml(users, commutes, kind="group")

    assert len(results) == 1
    assert results[0].kind == "group"
    assert set(results[0].participants) == {"u1", "u2", "u3"}


def test_no_match_when_time_window_does_not_overlap() -> None:
    users = [
        _build_user("u1", "women", ["music", "coffee", "hiking"]),
        _build_user("u2", "women", ["coffee", "movies", "reading"]),
    ]
    commutes = [
        _build_commute("u1", start=8 * 60, end=8 * 60 + 20),
        _build_commute("u2", start=9 * 60, end=9 * 60 + 20),
    ]

    results = _run_with_yaml(users, commutes, kind="individual")
    assert results == []


def _route_from_base(base_lat: float, base_lng: float, offset: float = 0.0) -> list[tuple[float, float]]:
    return [
        (base_lat + offset, base_lng + offset),
        (base_lat + 0.0010 + offset, base_lng + 0.0012 + offset),
        (base_lat + 0.0020 + offset, base_lng + 0.0021 + offset),
        (base_lat + 0.0030 + offset, base_lng + 0.0030 + offset),
    ]


def test_verbose_large_population_matching_logs_results() -> None:
    users: list[MatchingUser] = []
    commutes: list[MatchingCommute] = []

    interest_pool = [
        "coffee",
        "music",
        "running",
        "movies",
        "gaming",
        "hiking",
        "food",
        "travel",
        "photography",
        "yoga",
        "reading",
        "cooking",
        "cycling",
        "tech",
        "art",
        "podcasts",
        "basketball",
        "soccer",
        "chess",
        "board-games",
        "entrepreneurship",
        "design",
        "fashion",
        "languages",
    ]

    # 16 individual users:
    # - 12 are highly compatible on route/time
    # - 3 are intentionally harder to match
    # - 1 is transit-only to force at least one unmatched individual
    for index in range(16):
        user_id = f"ind-{index + 1:02d}"
        users.append(
            _build_user(
                user_id,
                "women" if index % 2 == 0 else "men",
                    [
                        interest_pool[index % len(interest_pool)],
                        interest_pool[(index + 1) % len(interest_pool)],
                        interest_pool[(index + 4) % len(interest_pool)],
                        interest_pool[(index + 9) % len(interest_pool)],
                        interest_pool[(index + 13) % len(interest_pool)],
                    ],
            )
        )
        if index < 12:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="individual",
                    group_min=2,
                    group_max=2,
                    gender_pref="any",
                    start=8 * 60,
                    end=9 * 60,
                    mode="walk",
                    route=_route_from_base(37.7749, -122.4194, offset=(index % 3) * 0.00003),
                )
            )
        elif index < 14:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="individual",
                    start=10 * 60,
                    end=11 * 60,
                    mode="walk",
                    route=_route_from_base(37.7749, -122.4194, offset=0.0001),
                )
            )
        elif index < 15:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="individual",
                    start=8 * 60,
                    end=9 * 60,
                    mode="walk",
                    route=_route_from_base(37.8044, -122.2712, offset=index * 0.0003),
                )
            )
        else:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="individual",
                    start=8 * 60,
                    end=9 * 60,
                    mode="transit",
                    route=_route_from_base(37.7800, -122.4100, offset=0.0002),
                )
            )

    # 20 group users:
    # - 8 users allow size 3-4 in corridor A (expected groups of 4)
    # - 9 users force size 3 in corridor B (expected groups of 3)
    # - 3 users intentionally isolated in corridor C (unmatched)
    for index in range(20):
        user_id = f"grp-{index + 1:02d}"
        if index < 8:
            group_interests = [
                "coffee",
                "music",
                "running",
                "yoga",
                "podcasts",
            ]
        elif index < 17:
            group_interests = [
                interest_pool[(index + 3) % len(interest_pool)],
                interest_pool[(index + 4) % len(interest_pool)],
                interest_pool[(index + 5) % len(interest_pool)],
                interest_pool[(index + 8) % len(interest_pool)],
                interest_pool[(index + 12) % len(interest_pool)],
            ]
        else:
            group_interests = [
                "food",
                "travel",
                "hiking",
                "photography",
                "languages",
            ]
        users.append(
            _build_user(
                user_id,
                "women" if index % 2 == 0 else "men",
                group_interests,
            )
        )

        if index < 8:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="group",
                    group_min=3,
                    group_max=4,
                    mode="walk",
                    start=8 * 60,
                    end=9 * 60 + 10,
                    route=_route_from_base(37.7650, -122.4300, offset=(index % 4) * 0.00003),
                )
            )
        elif index < 17:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="group",
                    group_min=3,
                    group_max=3,
                    mode="walk",
                    start=8 * 60 + 5,
                    end=9 * 60 + 5,
                    route=_route_from_base(37.7600, -122.4450, offset=(index % 3) * 0.00003),
                )
            )
        else:
            commutes.append(
                _build_commute(
                    user_id,
                    preference="group",
                    group_min=3,
                    group_max=4,
                    mode="walk",
                    start=8 * 60,
                    end=9 * 60,
                    route=_route_from_base(37.8100 + index * 0.002, -122.3000 - index * 0.002),
                )
            )

    individual_matches = _run_with_yaml(users, commutes, kind="individual")
    group_matches = _run_with_yaml(users, commutes, kind="group")

    individual_users = {user.auth0_id for user in users if user.auth0_id.startswith("ind-")}
    group_users = {user.auth0_id for user in users if user.auth0_id.startswith("grp-")}
    individual_matched = {user_id for match in individual_matches for user_id in match.participants}
    group_matched = {user_id for match in group_matches for user_id in match.participants}

    unmatched_individual = sorted(individual_users - individual_matched)
    unmatched_group = sorted(group_users - group_matched)
    group_size_distribution: dict[int, int] = {}
    for match in group_matches:
        size = len(match.participants)
        group_size_distribution[size] = group_size_distribution.get(size, 0) + 1

    print("\n=== Large Population Simulation (36 users) ===")
    print(f"individual matches: {len(individual_matches)}")
    for match in individual_matches:
        participants = ", ".join(match.participants)
        print(
            f"  pair [{participants}] "
            f"score={match.scores.composite_score:.3f} "
            f"overlap={match.scores.overlap_score:.3f} "
            f"interests={match.scores.interest_score:.3f}"
        )
    print(f"unmatched individual users ({len(unmatched_individual)}): {unmatched_individual}")

    print(f"group matches: {len(group_matches)}")
    for match in group_matches:
        participants = ", ".join(match.participants)
        print(
            f"  group size={len(match.participants)} [{participants}] "
            f"score={match.scores.composite_score:.3f}"
        )
    print(f"group size distribution: {group_size_distribution}")
    print(f"unmatched group users ({len(unmatched_group)}): {unmatched_group}")

    assert len(users) >= 30
    assert len(individual_matches) > 0
    assert len(group_matches) > 0
    assert len(unmatched_individual) > 0
    assert len(unmatched_group) > 0
    assert 3 in group_size_distribution
    assert 4 in group_size_distribution

