from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from beanie import Document
from pydantic import BaseModel, Field


class CommutePoint(BaseModel):
    name: str
    lat: float
    lng: float


class GroupSizePreference(BaseModel):
    min: int
    max: int


class TimeWindow(BaseModel):
    start_minute: int = Field(ge=0, le=1439)
    end_minute: int = Field(ge=1, le=1440)


class RouteSegment(BaseModel):
    type: Literal["walk", "transit"]
    coordinates: list[tuple[float, float]]
    label: str | None = None
    transit_line: str | None = None
    duration_minutes: int | None = None


class Commute(Document):
    user_auth0_id: str
    start: CommutePoint
    end: CommutePoint
    time_window: TimeWindow
    transport_mode: Literal["walk", "transit"]
    match_preference: Literal["individual", "group", "both"]
    group_size_pref: GroupSizePreference
    gender_preference: Literal["any", "same"] = "any"
    status: Literal["queued", "paused"] = "paused"
    enable_queue_flow: bool = False
    enable_suggestions_flow: bool = True
    queue_days_of_week: list[int] = Field(default_factory=list)
    route_segments: list[RouteSegment] = Field(default_factory=list)
    route_coordinates: list[tuple[float, float]] = Field(default_factory=list)
    otp_total_duration_minutes: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "commutes"

