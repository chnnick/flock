from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import AuthenticatedUser
from src.chat.schemas import (
    ChatMessageResponse,
    ChatRoomDetailResponse,
    ChatRoomSummaryResponse,
    ContinuationRequest,
    ContinuationResponse,
    IntroductionRequest,
    IntroductionResponse,
    QuestionsRequest,
    QuestionsResponse,
    SendMessageRequest,
)
from src.chat.service import (
    get_room_for_user,
    get_room_last_message,
    list_messages_for_room,
    list_rooms_for_user,
    send_message_for_room,
)
from src.gemini.gemini import GeminiClient

router = APIRouter(tags=["chat"])


def _to_message_response(message) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=str(message.id),
        chat_room_id=message.chat_room_id,
        sender_auth0_id=message.sender_auth0_id,
        sender_name=message.sender_name,
        body=message.body,
        is_system=message.is_system,
        created_at=message.created_at.isoformat(),
    )


def _to_room_summary_response(room, last_message) -> ChatRoomSummaryResponse:
    return ChatRoomSummaryResponse(
        id=str(room.id),
        match_id=room.match_id,
        participants=room.participants,
        type=room.type,
        last_message=last_message.body if last_message else None,
        last_message_time=last_message.created_at.isoformat() if last_message else None,
        created_at=room.created_at.isoformat(),
        updated_at=room.updated_at.isoformat(),
    )


@router.get("/chats", response_model=list[ChatRoomSummaryResponse])
async def list_chats(claims: AuthenticatedUser) -> list[ChatRoomSummaryResponse]:
    rooms = await list_rooms_for_user(claims.user_id)
    last_messages = await asyncio.gather(*(get_room_last_message(str(room.id)) for room in rooms))
    summaries = [
        _to_room_summary_response(room, last_message)
        for room, last_message in zip(rooms, last_messages, strict=False)
    ]
    return sorted(
        summaries,
        key=lambda item: item.last_message_time or item.created_at,
        reverse=True,
    )


@router.get("/chats/{room_id}", response_model=ChatRoomDetailResponse)
async def get_chat_room(room_id: str, claims: AuthenticatedUser) -> ChatRoomDetailResponse:
    room = await get_room_for_user(claims.user_id, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    messages = await list_messages_for_room(room_id)
    last_message = messages[-1] if messages else None
    summary = _to_room_summary_response(room, last_message)
    return ChatRoomDetailResponse(
        **summary.model_dump(),
        messages=[_to_message_response(message) for message in messages],
    )


@router.post("/chats/{room_id}/messages", response_model=ChatMessageResponse)
async def post_chat_message(
    room_id: str,
    payload: SendMessageRequest,
    claims: AuthenticatedUser,
) -> ChatMessageResponse:
    if not payload.body.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message body is required")
    message = await send_message_for_room(
        auth0_id=claims.user_id,
        room_id=room_id,
        body=payload.body,
    )
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    return _to_message_response(message)


@router.post("/chat/introduction", response_model=IntroductionResponse)
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


@router.post("/chat/continuation", response_model=ContinuationResponse)
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


@router.post("/chat/questions", response_model=QuestionsResponse)
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
