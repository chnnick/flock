from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal

from beanie import Document
from pydantic import BaseModel, Field


class MatchPoint(BaseModel):
    name: str
    lat: float
    lng: float


class MatchScores(BaseModel):
    overlap_score: float
    interest_score: float
    composite_score: float


class ParticipantDecision(BaseModel):
    auth0_id: str
    accepted_at: datetime | None = None
    passed_at: datetime | None = None
    pass_cooldown_until: datetime | None = None


class MatchSuggestion(Document):
    source: Literal["suggested", "queue_assigned"]
    kind: Literal["individual", "group"]
    status: Literal["suggested", "assigned", "active", "completed"]
    participants: list[str]
    transport_mode: Literal["walk", "transit"]
    scores: MatchScores
    compatibility_percent: int
    shared_segment_start: MatchPoint
    shared_segment_end: MatchPoint
    estimated_time_minutes: int
    decisions: list[ParticipantDecision] = Field(default_factory=list)
    chat_room_id: str | None = None
    commute_date: date | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "matches"

