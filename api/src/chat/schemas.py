from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_serializer


class ChatMessageCreate(BaseModel):
    body: str


class ChatMessageResponse(BaseModel):
    id: str
    chat_room_id: str
    sender_auth0_id: str | None
    sender_name: str
    body: str
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("id")
    def serialize_id(self, value: object) -> str | None:
        return str(value) if value is not None else None


class ChatRoomSummaryResponse(BaseModel):
    id: str
    match_id: str
    participants: list[str]
    type: Literal["dm", "group"]
    last_message: str | None
    last_message_time: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("id")
    def serialize_id(self, value: object) -> str | None:
        return str(value) if value is not None else None


class ChatRoomDetailResponse(ChatRoomSummaryResponse):
    messages: list[ChatMessageResponse]

