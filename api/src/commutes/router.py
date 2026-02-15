from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import AuthenticatedUser
from src.commutes.schemas import CommuteCreate, CommuteResponse, CommuteUpdate
from src.commutes.service import (
    create_or_replace_commute,
    get_my_commute,
    patch_my_commute,
    pause_matching,
    set_queue_enabled,
    set_suggestions_enabled,
)
from src.routing.service import RouteGenerationError

router = APIRouter(prefix="/commutes", tags=["commutes"])


def _to_response(commute) -> CommuteResponse:
    return CommuteResponse(
        id=str(commute.id),
        user_auth0_id=commute.user_auth0_id,
        start={
            "name": commute.start.name,
            "lat": commute.start.lat,
            "lng": commute.start.lng,
        },
        end={
            "name": commute.end.name,
            "lat": commute.end.lat,
            "lng": commute.end.lng,
        },
        time_window={
            "start_minute": commute.time_window.start_minute,
            "end_minute": commute.time_window.end_minute,
        },
        transport_mode=commute.transport_mode,
        match_preference=commute.match_preference,
        group_size_pref={
            "min": commute.group_size_pref.min,
            "max": commute.group_size_pref.max,
        },
        gender_preference=commute.gender_preference,
        status=commute.status,
        enable_queue_flow=commute.enable_queue_flow,
        enable_suggestions_flow=commute.enable_suggestions_flow,
        queue_days_of_week=commute.queue_days_of_week,
        route_segments=[
            {
                "type": segment.type,
                "coordinates": segment.coordinates,
                "label": segment.label,
                "transit_line": segment.transit_line,
                "duration_minutes": segment.duration_minutes,
            }
            for segment in commute.route_segments
        ],
        route_coordinates=commute.route_coordinates,
        otp_total_duration_minutes=commute.otp_total_duration_minutes,
        created_at=commute.created_at,
        updated_at=commute.updated_at,
    )


@router.get("/me", response_model=CommuteResponse)
async def get_me_commute(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await get_my_commute(claims.user_id)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return _to_response(commute)


@router.post("/me", response_model=CommuteResponse)
async def create_me_commute(claims: AuthenticatedUser, body: CommuteCreate) -> CommuteResponse:
    try:
        commute = await create_or_replace_commute(claims.user_id, body)
    except RouteGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Route generation failed: {exc}",
        ) from exc
    return _to_response(commute)


@router.patch("/me", response_model=CommuteResponse)
async def patch_me_commute(claims: AuthenticatedUser, body: CommuteUpdate) -> CommuteResponse:
    try:
        commute = await patch_my_commute(claims.user_id, body)
    except RouteGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Route generation failed: {exc}",
        ) from exc
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return _to_response(commute)


@router.post("/me/queue", response_model=CommuteResponse)
async def enable_queue_flow(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await set_queue_enabled(claims.user_id, enabled=True)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return _to_response(commute)


@router.post("/me/suggestions", response_model=CommuteResponse)
async def enable_suggestions_flow(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await set_suggestions_enabled(claims.user_id, enabled=True)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return _to_response(commute)


@router.post("/me/pause", response_model=CommuteResponse)
async def pause_me_matching(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await pause_matching(claims.user_id)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return _to_response(commute)

