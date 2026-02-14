from beanie import Document
from pydantic import Field
from datetime import datetime, timezone

class ChatMessage(Document):
    room_id: str
    sender_id: str
    sender_name: str
    body: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_system: bool = False

    class Settings:
        name = "chat_messages"
        indexes = [
            "room_id",
            "timestamp"
        ]

class ChatRoom(Document):
    match_id: str
    participant_ids: list[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "chat_rooms"
