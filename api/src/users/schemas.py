from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class UserCreate(BaseModel):
    name: str
    occupation: str
    gender: str
    interests: list[str] = Field(default_factory=list, min_length=3)


class UserUpdate(BaseModel):
    name: str | None = None
    occupation: str | None = None
    gender: str | None = None
    interests: list[str] | None = None


class UserResponse(BaseModel):
    id: str
    auth0_id: str
    name: str
    occupation: str
    gender: str
    interests: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def convert_objectid(cls, v):
        return str(v)