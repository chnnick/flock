from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import AuthenticatedUser
from src.db.models.match_suggestion import MatchSuggestion
from src.db.models.user import User
from src.matching.algorithm import MatchKind
from src.matching.schemas import MatchRunResponse, MatchSuggestionResponse
from src.matching.service import (
    accept_suggestion,
    list_active_for_user,
    list_assignments_for_user,
    list_suggestions_for_user,
    pass_suggestion,
    run_matching_cycle,
)

router = APIRouter(prefix="/matching", tags=["matching"])


async def _to_response(item: MatchSuggestion) -> MatchSuggestionResponse:
    users = await User.find(User.auth0_id.in_(item.participants)).to_list()
    users_by_auth0_id = {user.auth0_id: user for user in users}

    participant_profiles = []
    for auth0_id in item.participants:
        user = users_by_auth0_id.get(auth0_id)
        if user:
            participant_profiles.append(
                {
                    "auth0_id": user.auth0_id,
                    "name": user.name,
                    "occupation": user.occupation,
                    "gender": user.gender,
                    "interests": user.interests,
                }
            )
        else:
            participant_profiles.append(
                {
                    "auth0_id": auth0_id,
                    "name": "Unknown",
                    "occupation": "Unknown",
                    "gender": "unknown",
                    "interests": [],
                }
            )

    payload = item.model_dump()
    payload["participants"] = participant_profiles
    payload["participant_auth0_ids"] = item.participants
    return MatchSuggestionResponse.model_validate(payload)


@router.post("/run", response_model=MatchRunResponse)
async def run_matching(run_queue: bool = False) -> MatchRunResponse:
    result = await run_matching_cycle(run_queue=run_queue)
    return MatchRunResponse.model_validate(result)


@router.get("/suggestions", response_model=list[MatchSuggestionResponse])
async def get_suggestions(
    claims: AuthenticatedUser,
    kind: MatchKind = Query(default="individual"),
) -> list[MatchSuggestionResponse]:
    suggestions = await list_suggestions_for_user(claims.user_id, kind)
    return [await _to_response(item) for item in suggestions]


@router.post("/suggestions/{suggestion_id}/accept", response_model=MatchSuggestionResponse)
async def accept_match_suggestion(
    suggestion_id: str,
    claims: AuthenticatedUser,
) -> MatchSuggestionResponse:
    suggestion = await accept_suggestion(claims.user_id, suggestion_id)
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found",
        )
    return await _to_response(suggestion)


@router.post("/suggestions/{suggestion_id}/pass", response_model=MatchSuggestionResponse)
async def pass_match_suggestion(
    suggestion_id: str,
    claims: AuthenticatedUser,
) -> MatchSuggestionResponse:
    suggestion = await pass_suggestion(claims.user_id, suggestion_id)
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found",
        )
    return await _to_response(suggestion)


@router.get("/active", response_model=list[MatchSuggestionResponse])
async def get_active_matches(
    claims: AuthenticatedUser,
    kind: MatchKind = Query(default="individual"),
) -> list[MatchSuggestionResponse]:
    matches = await list_active_for_user(claims.user_id, kind)
    return [await _to_response(item) for item in matches]


@router.get("/assignments", response_model=list[MatchSuggestionResponse])
async def get_assignments(
    claims: AuthenticatedUser,
    kind: MatchKind = Query(default="individual"),
    for_date: date | None = Query(default=None, alias="date"),
) -> list[MatchSuggestionResponse]:
    commute_date = for_date or (date.today() + timedelta(days=1))
    assignments = await list_assignments_for_user(claims.user_id, kind, commute_date)
    return [await _to_response(item) for item in assignments]

