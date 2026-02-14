from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, field_serializer


class MatchPointResponse(BaseModel):
    name: str
    lat: float
    lng: float


class MatchScoresResponse(BaseModel):
    overlap_score: float
    interest_score: float
    composite_score: float


class DecisionResponse(BaseModel):
    auth0_id: str
    accepted_at: datetime | None
    passed_at: datetime | None
    pass_cooldown_until: datetime | None


class MatchSuggestionResponse(BaseModel):
    id: str
    source: Literal["suggested", "queue_assigned"]
    kind: Literal["individual", "group"]
    status: Literal["suggested", "assigned", "active", "completed"]
    participants: list[str]
    transport_mode: Literal["walk", "transit"]
    scores: MatchScoresResponse
    compatibility_percent: int
    shared_segment_start: MatchPointResponse
    shared_segment_end: MatchPointResponse
    estimated_time_minutes: int
    decisions: list[DecisionResponse]
    chat_room_id: str | None
    commute_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("id")
    def serialize_id(self, value: object) -> str | None:
        return str(value) if value is not None else None


class MatchRunResponse(BaseModel):
    suggestions_individual: int
    suggestions_group: int
    assignments_individual: int
    assignments_group: int

