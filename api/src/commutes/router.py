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


@router.get("/me", response_model=CommuteResponse)
async def get_me_commute(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await get_my_commute(claims.user_id)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return CommuteResponse.model_validate(commute)


@router.post("/me", response_model=CommuteResponse)
async def create_me_commute(claims: AuthenticatedUser, body: CommuteCreate) -> CommuteResponse:
    try:
        commute = await create_or_replace_commute(claims.user_id, body)
    except RouteGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Route generation failed: {exc}",
        ) from exc
    return CommuteResponse.model_validate(commute)


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
    return CommuteResponse.model_validate(commute)


@router.post("/me/queue", response_model=CommuteResponse)
async def enable_queue_flow(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await set_queue_enabled(claims.user_id, enabled=True)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return CommuteResponse.model_validate(commute)


@router.post("/me/suggestions", response_model=CommuteResponse)
async def enable_suggestions_flow(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await set_suggestions_enabled(claims.user_id, enabled=True)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return CommuteResponse.model_validate(commute)


@router.post("/me/pause", response_model=CommuteResponse)
async def pause_me_matching(claims: AuthenticatedUser) -> CommuteResponse:
    commute = await pause_matching(claims.user_id)
    if not commute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commute not found")
    return CommuteResponse.model_validate(commute)

