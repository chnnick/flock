from __future__ import annotations

from datetime import datetime, timezone

from src.db.models.chat_message import ChatMessage
from src.db.models.chat_room import ChatRoom
from src.users.service import get_by_auth0_id


async def list_rooms_for_user(auth0_id: str) -> list[ChatRoom]:
    rooms = await ChatRoom.find_all().to_list()
    return [room for room in rooms if auth0_id in room.participants]


async def get_room_for_user(auth0_id: str, room_id: str) -> ChatRoom | None:
    room = await ChatRoom.get(room_id)
    if not room or auth0_id not in room.participants:
        return None
    return room


async def list_messages_for_room(room_id: str) -> list[ChatMessage]:
    messages = await ChatMessage.find(ChatMessage.chat_room_id == room_id).to_list()
    return sorted(messages, key=lambda message: message.created_at)


async def get_room_last_message(room_id: str) -> ChatMessage | None:
    messages = await list_messages_for_room(room_id)
    if not messages:
        return None
    return messages[-1]


async def send_message_for_room(
    *,
    auth0_id: str,
    room_id: str,
    body: str,
) -> ChatMessage | None:
    room = await get_room_for_user(auth0_id, room_id)
    if not room:
        return None

    user = await get_by_auth0_id(auth0_id)
    sender_name = user.name if user else "Commuter"
    message = ChatMessage(
        chat_room_id=room_id,
        sender_auth0_id=auth0_id,
        sender_name=sender_name,
        body=body.strip(),
        is_system=False,
    )
    await message.insert()

    room.updated_at = datetime.now(timezone.utc)
    await room.save()
    return message

