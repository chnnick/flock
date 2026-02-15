from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UserForIntro(BaseModel):
    name: str
    occupation: str
    interests: list[str] = Field(default_factory=list)


class IntroductionRequest(BaseModel):
    users: list[UserForIntro]


class IntroductionResponse(BaseModel):
    introduction: str


class ChatMessageForApi(BaseModel):
    role: str  # "user" or "model"
    name: str
    content: str


class ContinuationRequest(BaseModel):
    messages: list[ChatMessageForApi]


class ContinuationResponse(BaseModel):
    continuation: str | None  # None if conversation is flowing


class QuestionsRequest(BaseModel):
    messages: list[ChatMessageForApi]


class QuestionsResponse(BaseModel):
    questions: str


# Real-time chat (WebSocket) schemas
class MessageBase(BaseModel):
    room_id: str
    sender_id: str
    sender_name: str
    body: str


class MessageCreate(MessageBase):
    is_system: bool = False


class MessageRead(MessageBase):
    id: str
    timestamp: datetime
    is_system: bool


class ChatRoomRead(BaseModel):
    id: str
    match_id: str
    participant_ids: list[str]
    created_at: datetime
