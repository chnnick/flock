from beanie import Document
from pydantic import Field
from datetime import datetime, timezone

class User(Document):
    auth0_id: str
    name: str
    occupation: str
    gender: str
    interests: list[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"