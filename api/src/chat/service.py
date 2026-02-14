import json
import redis
import os
from datetime import datetime, timezone
from src.db.models.chat import ChatMessage, ChatRoom
from src.chat.schemas import MessageCreate
from src.config import settings

# Connection details from environment variables
cache = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    username=settings.REDIS_USERNAME,
    password=settings.REDIS_PASSWORD,
)

class ChatService:
    @staticmethod
    async def save_message(msg_data: MessageCreate):
        # 1. Save to MongoDB for permanent storage
        db_msg = ChatMessage(
            room_id=msg_data.room_id,
            sender_id=msg_data.sender_id,
            sender_name=msg_data.sender_name,
            body=msg_data.body,
            timestamp=datetime.now(timezone.utc),
            is_system=False
        )
        await db_msg.insert()

        # 2. Cache in Redis (store latest 50 messages for quick access)
        redis_key = f"chat:room:{msg_data.room_id}:recent"
        msg_json = json.dumps({
            "id": str(db_msg.id),
            "room_id": db_msg.room_id,
            "sender_id": db_msg.sender_id,
            "sender_name": db_msg.sender_name,
            "body": db_msg.body,
            "timestamp": db_msg.timestamp.isoformat(),
            "is_system": db_msg.is_system
        })
        
        # Add to list and keep only latest 50
        await cache.lpush(redis_key, msg_json)
        await cache.ltrim(redis_key, 0, 49)
        
        return db_msg

    @staticmethod
    async def get_recent_messages(room_id: str, limit: int = 50):
        redis_key = f"chat:room:{room_id}:recent"
        cached_msgs = cache.lrange(redis_key, 0, limit - 1)
        
        if cached_msgs:
            # redis stores them with newest first because we lpush
            return [json.loads(m) for m in cached_msgs][::-1]

        # If not in cache, get from MongoDB
        db_msgs = await ChatMessage.find(ChatMessage.room_id == room_id).sort("-timestamp").limit(limit).to_list()
        
        # Return in chronological order
        return sorted(db_msgs, key=lambda x: x.timestamp)

    @staticmethod
    async def get_messages_for_gemini(room_id: str, limit: int = 10):
        """Returns messages in format expected by GeminiClient"""
        msgs = await ChatService.get_recent_messages(room_id, limit)
        gemini_msgs = []
        for m in msgs:
            # Handle both dict (from Redis) and Beanie objects
            if isinstance(m, dict):
                gemini_msgs.append({
                    "role": "user", # or "model" if we track that
                    "content": m["body"],
                    "name": m["sender_name"]
                })
            else:
                gemini_msgs.append({
                    "role": "user",
                    "content": m.body,
                    "name": m.sender_name
                })
        return gemini_msgs

chat_service = ChatService()
