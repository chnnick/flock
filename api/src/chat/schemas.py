from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MessageBase(BaseModel):
    room_id: str
    sender_id: str
    sender_name: str
    body: str


class MessageCreate(MessageBase):
    pass


class MessageRead(MessageBase):
    id: str
    timestamp: datetime
    is_system: bool


class ChatRoomRead(BaseModel):
    id: str
    match_id: str
    participant_ids: list[str]
    created_at: datetime


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


class ChatRoomSummaryResponse(BaseModel):
    id: str
    match_id: str
    participants: list[str]
    type: str
    last_message: str | None
    last_message_time: str | None
    created_at: str
    updated_at: str


class ChatMessageResponse(BaseModel):
    id: str
    chat_room_id: str
    sender_auth0_id: str | None
    sender_name: str
    body: str
    is_system: bool
    created_at: str


class ChatRoomDetailResponse(ChatRoomSummaryResponse):
    messages: list[ChatMessageResponse]


class SendMessageRequest(BaseModel):
    body: str
