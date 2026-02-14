from datetime import datetime
from pydantic import BaseModel


class UserCreateDTO(BaseModel):
    name: str
    occupation: str
    gender: str
    interests: list[str] = []


class UserResponseDTO(BaseModel):
    id: str
    auth0_id: str
    name: str
    occupation: str
    gender: str
    interests: list[str]
    created_at: datetime
    updated_at: datetime
