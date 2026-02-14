from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.chat.schemas import IntroductionRequest, IntroductionResponse
from src.gemini.gemini import GeminiClient

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/introduction", response_model=IntroductionResponse)
async def generate_introduction(body: IntroductionRequest) -> IntroductionResponse:
    """Generate a warm introduction for mutual friends based on their profiles."""
    if not body.users or len(body.users) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 users required for introduction",
        )
    try:
        client = GeminiClient()
        users_dict = [
            {"name": u.name, "occupation": u.occupation, "interests": u.interests}
            for u in body.users
        ]
        intro = client.generate_initial_introduction(users_dict)
        return IntroductionResponse(introduction=intro)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate introduction: {str(e)}",
        ) from e
