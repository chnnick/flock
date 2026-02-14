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
