from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import AuthenticatedUser
from src.chat.schemas import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatRoomDetailResponse,
    ChatRoomSummaryResponse,
)
from src.chat.service import (
    get_room_for_user,
    get_room_last_message,
    list_messages_for_room,
    list_rooms_for_user,
    send_message_for_room,
)

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatRoomSummaryResponse])
async def list_my_rooms(claims: AuthenticatedUser) -> list[ChatRoomSummaryResponse]:
    rooms = await list_rooms_for_user(claims.user_id)
    responses: list[ChatRoomSummaryResponse] = []
    for room in rooms:
        last_message = await get_room_last_message(str(room.id))
        responses.append(
            ChatRoomSummaryResponse(
                id=str(room.id),
                match_id=room.match_id,
                participants=room.participants,
                type=room.type,
                last_message=last_message.body if last_message else None,
                last_message_time=last_message.created_at if last_message else None,
                created_at=room.created_at,
                updated_at=room.updated_at,
            )
        )
    responses.sort(
        key=lambda room: room.last_message_time or room.updated_at,
        reverse=True,
    )
    return responses


@router.get("/{room_id}", response_model=ChatRoomDetailResponse)
async def get_room_details(room_id: str, claims: AuthenticatedUser) -> ChatRoomDetailResponse:
    room = await get_room_for_user(claims.user_id, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")

    messages = await list_messages_for_room(room_id)
    last_message = messages[-1] if messages else None
    return ChatRoomDetailResponse(
        id=str(room.id),
        match_id=room.match_id,
        participants=room.participants,
        type=room.type,
        last_message=last_message.body if last_message else None,
        last_message_time=last_message.created_at if last_message else None,
        created_at=room.created_at,
        updated_at=room.updated_at,
        messages=[ChatMessageResponse.model_validate(message) for message in messages],
    )


@router.post("/{room_id}/messages", response_model=ChatMessageResponse)
async def send_room_message(
    room_id: str,
    body: ChatMessageCreate,
    claims: AuthenticatedUser,
) -> ChatMessageResponse:
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message body is required")
    message = await send_message_for_room(auth0_id=claims.user_id, room_id=room_id, body=text)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    return ChatMessageResponse.model_validate(message)

