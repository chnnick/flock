from __future__ import annotations

import json
from datetime import datetime, timezone

import redis

from src.chat.schemas import MessageCreate
from src.db.models.chat_message import ChatMessage
from src.db.models.chat_room import ChatRoom
from src.users.service import get_by_auth0_id

# Redis cache for recent messages (optional: set REDIS_URL in env or leave unset to skip cache)
_cache: redis.Redis | None = None


def _get_redis() -> redis.Redis | None:
    global _cache
    if _cache is not None:
        return _cache
    try:
        _cache = redis.Redis(
            host="localhost",
            port=6379,
            decode_responses=True,
        )
        _cache.ping()
        return _cache
    except Exception:
        return None


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


class ChatService:
    """Real-time chat: save to MongoDB + Redis cache, fetch recent for WebSocket history."""

    @staticmethod
    async def save_message(msg_data: MessageCreate) -> ChatMessage:
        db_msg = ChatMessage(
            chat_room_id=msg_data.room_id,
            sender_auth0_id=msg_data.sender_id,
            sender_name=msg_data.sender_name,
            body=msg_data.body,
            is_system=msg_data.is_system,
        )
        await db_msg.insert()

        cache = _get_redis()
        if cache:
            redis_key = f"chat:room:{msg_data.room_id}:recent"
            msg_json = json.dumps({
                "id": str(db_msg.id),
                "room_id": db_msg.chat_room_id,
                "sender_id": db_msg.sender_auth0_id or "system",
                "sender_name": db_msg.sender_name,
                "body": db_msg.body,
                "timestamp": db_msg.created_at.isoformat(),
                "is_system": db_msg.is_system,
            })
            cache.lpush(redis_key, msg_json)
            cache.ltrim(redis_key, 0, 49)

        return db_msg

    @staticmethod
    async def get_recent_messages(room_id: str, limit: int = 50) -> list[ChatMessage] | list[dict]:
        cache = _get_redis()
        if cache:
            redis_key = f"chat:room:{room_id}:recent"
            cached_msgs = cache.lrange(redis_key, 0, limit - 1)
            if cached_msgs:
                return [json.loads(m) for m in cached_msgs][::-1]

        db_msgs = await ChatMessage.find(ChatMessage.chat_room_id == room_id).sort("-created_at").limit(limit).to_list()
        return sorted(db_msgs, key=lambda x: x.created_at)

    @staticmethod
    async def get_messages_for_gemini(room_id: str, limit: int = 10) -> list[dict]:
        msgs = await ChatService.get_recent_messages(room_id, limit)
        result = []
        for m in msgs:
            if isinstance(m, dict):
                result.append({
                    "role": "user",
                    "content": m["body"],
                    "name": m["sender_name"],
                })
            else:
                result.append({
                    "role": "user",
                    "content": m.body,
                    "name": m.sender_name,
                })
        return result


chat_service = ChatService()
