from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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
