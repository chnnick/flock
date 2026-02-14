from datetime import datetime
from pydantic import BaseModel, Field, field_serializer


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

    @field_serializer("id")
    def serialize_id(self, v):
        return str(v) if v is not None else v
