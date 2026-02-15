from __future__ import annotations

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
