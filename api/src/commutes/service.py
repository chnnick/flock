from __future__ import annotations

from datetime import datetime, timezone

from src.commutes.schemas import CommuteCreate, CommuteUpdate
from src.db.models.commute import Commute


def _normalized_group_size(
    preference: str,
    requested_min: int,
    requested_max: int,
) -> tuple[int, int]:
    if preference == "individual":
        return (2, 2)
    normalized_min = max(3, requested_min)
    normalized_max = max(normalized_min, min(4, requested_max))
    return (normalized_min, normalized_max)


async def get_my_commute(auth0_id: str) -> Commute | None:
    return await Commute.find_one(Commute.user_auth0_id == auth0_id)


async def create_or_replace_commute(auth0_id: str, payload: CommuteCreate) -> Commute:
    existing = await get_my_commute(auth0_id)
    min_size, max_size = _normalized_group_size(
        payload.match_preference,
        payload.group_size_pref.min,
        payload.group_size_pref.max,
    )

    if existing:
        existing.start = payload.start.model_dump()
        existing.end = payload.end.model_dump()
        existing.time_window = payload.time_window.model_dump()
        existing.transport_mode = payload.transport_mode
        existing.match_preference = payload.match_preference
        existing.group_size_pref = {"min": min_size, "max": max_size}
        existing.gender_preference = payload.gender_preference
        existing.enable_queue_flow = payload.enable_queue_flow
        existing.enable_suggestions_flow = payload.enable_suggestions_flow
        existing.queue_days_of_week = payload.queue_days_of_week
        existing.route_segments = [
            segment.model_dump() for segment in payload.route_segments
        ]
        existing.route_coordinates = payload.route_coordinates
        existing.updated_at = datetime.now(timezone.utc)
        await existing.save()
        return existing

    commute = Commute(
        user_auth0_id=auth0_id,
        start=payload.start.model_dump(),
        end=payload.end.model_dump(),
        time_window=payload.time_window.model_dump(),
        transport_mode=payload.transport_mode,
        match_preference=payload.match_preference,
        group_size_pref={"min": min_size, "max": max_size},
        gender_preference=payload.gender_preference,
        enable_queue_flow=payload.enable_queue_flow,
        enable_suggestions_flow=payload.enable_suggestions_flow,
        queue_days_of_week=payload.queue_days_of_week,
        route_segments=[segment.model_dump() for segment in payload.route_segments],
        route_coordinates=payload.route_coordinates,
    )
    await commute.insert()
    return commute


async def patch_my_commute(auth0_id: str, payload: CommuteUpdate) -> Commute | None:
    commute = await get_my_commute(auth0_id)
    if not commute:
        return None

    if payload.start is not None:
        commute.start = payload.start.model_dump()
    if payload.end is not None:
        commute.end = payload.end.model_dump()
    if payload.time_window is not None:
        commute.time_window = payload.time_window.model_dump()
    if payload.transport_mode is not None:
        commute.transport_mode = payload.transport_mode
    if payload.match_preference is not None:
        commute.match_preference = payload.match_preference
    if payload.group_size_pref is not None:
        normalized_min, normalized_max = _normalized_group_size(
            commute.match_preference,
            payload.group_size_pref.min,
            payload.group_size_pref.max,
        )
        commute.group_size_pref = {"min": normalized_min, "max": normalized_max}
    if payload.gender_preference is not None:
        commute.gender_preference = payload.gender_preference
    if payload.enable_queue_flow is not None:
        commute.enable_queue_flow = payload.enable_queue_flow
    if payload.enable_suggestions_flow is not None:
        commute.enable_suggestions_flow = payload.enable_suggestions_flow
    if payload.queue_days_of_week is not None:
        commute.queue_days_of_week = payload.queue_days_of_week
    if payload.route_segments is not None:
        commute.route_segments = [segment.model_dump() for segment in payload.route_segments]
    if payload.route_coordinates is not None:
        commute.route_coordinates = payload.route_coordinates

    if commute.match_preference == "individual":
        commute.group_size_pref = {"min": 2, "max": 2}
    else:
        min_size, max_size = _normalized_group_size(
            "group",
            commute.group_size_pref["min"],
            commute.group_size_pref["max"],
        )
        commute.group_size_pref = {"min": min_size, "max": max_size}

    commute.updated_at = datetime.now(timezone.utc)
    await commute.save()
    return commute


async def set_queue_enabled(auth0_id: str, enabled: bool) -> Commute | None:
    commute = await get_my_commute(auth0_id)
    if not commute:
        return None
    commute.enable_queue_flow = enabled
    commute.status = "queued" if enabled else "paused"
    commute.updated_at = datetime.now(timezone.utc)
    await commute.save()
    return commute


async def set_suggestions_enabled(auth0_id: str, enabled: bool) -> Commute | None:
    commute = await get_my_commute(auth0_id)
    if not commute:
        return None
    commute.enable_suggestions_flow = enabled
    commute.status = "queued" if enabled else "paused"
    commute.updated_at = datetime.now(timezone.utc)
    await commute.save()
    return commute


async def pause_matching(auth0_id: str) -> Commute | None:
    commute = await get_my_commute(auth0_id)
    if not commute:
        return None
    commute.status = "paused"
    commute.updated_at = datetime.now(timezone.utc)
    await commute.save()
    return commute

