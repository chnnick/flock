from __future__ import annotations

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field


class ChatMessage(Document):
    chat_room_id: str
    sender_auth0_id: str | None = None
    sender_name: str
    body: str
    is_system: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "chat_messages"


