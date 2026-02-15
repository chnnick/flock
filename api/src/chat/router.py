from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.chat.schemas import (
    ContinuationRequest,
    ContinuationResponse,
    IntroductionRequest,
    IntroductionResponse,
    QuestionsRequest,
    QuestionsResponse,
)
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


@router.post("/continuation", response_model=ContinuationResponse)
async def get_continuation(body: ContinuationRequest) -> ContinuationResponse:
    """Check if conversation is dry; return intervention or None."""
    if not body.messages:
        return ContinuationResponse(continuation=None)
    try:
        client = GeminiClient()
        messages_dict = [
            {"role": m.role, "name": m.name, "content": m.content}
            for m in body.messages
        ]
        continuation = client.get_chat_continuation(messages_dict)
        return ContinuationResponse(continuation=continuation)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get continuation: {str(e)}",
        ) from e


@router.post("/questions", response_model=QuestionsResponse)
async def generate_questions(body: QuestionsRequest) -> QuestionsResponse:
    """Generate new questions based on conversation context."""
    try:
        client = GeminiClient()
        messages_dict = [
            {"role": m.role, "name": m.name, "content": m.content}
            for m in body.messages
        ]
        questions = client.generate_new_questions(messages_dict)
        return QuestionsResponse(questions=questions)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate questions: {str(e)}",
        ) from e
