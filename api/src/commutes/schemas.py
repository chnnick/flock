from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_serializer


class CommutePointPayload(BaseModel):
    name: str
    lat: float
    lng: float


class GroupSizePreferencePayload(BaseModel):
    min: int
    max: int


class TimeWindowPayload(BaseModel):
    start_minute: int = Field(ge=0, le=1439)
    end_minute: int = Field(ge=1, le=1440)


class RouteSegmentPayload(BaseModel):
    type: Literal["walk", "transit"]
    coordinates: list[tuple[float, float]]
    label: str | None = None
    transit_line: str | None = None


class CommuteCreate(BaseModel):
    start: CommutePointPayload
    end: CommutePointPayload
    time_window: TimeWindowPayload
    transport_mode: Literal["walk", "transit"]
    match_preference: Literal["individual", "group"]
    group_size_pref: GroupSizePreferencePayload
    gender_preference: Literal["any", "same"] = "any"
    enable_queue_flow: bool = False
    enable_suggestions_flow: bool = True
    queue_days_of_week: list[int] = Field(default_factory=list)
    route_segments: list[RouteSegmentPayload] = Field(default_factory=list)
    route_coordinates: list[tuple[float, float]] = Field(default_factory=list)


class CommuteUpdate(BaseModel):
    start: CommutePointPayload | None = None
    end: CommutePointPayload | None = None
    time_window: TimeWindowPayload | None = None
    transport_mode: Literal["walk", "transit"] | None = None
    match_preference: Literal["individual", "group"] | None = None
    group_size_pref: GroupSizePreferencePayload | None = None
    gender_preference: Literal["any", "same"] | None = None
    enable_queue_flow: bool | None = None
    enable_suggestions_flow: bool | None = None
    queue_days_of_week: list[int] | None = None
    route_segments: list[RouteSegmentPayload] | None = None
    route_coordinates: list[tuple[float, float]] | None = None


class CommuteResponse(BaseModel):
    id: str
    user_auth0_id: str
    start: CommutePointPayload
    end: CommutePointPayload
    time_window: TimeWindowPayload
    transport_mode: Literal["walk", "transit"]
    match_preference: Literal["individual", "group"]
    group_size_pref: GroupSizePreferencePayload
    gender_preference: Literal["any", "same"]
    status: Literal["queued", "paused"]
    enable_queue_flow: bool
    enable_suggestions_flow: bool
    queue_days_of_week: list[int]
    route_segments: list[RouteSegmentPayload]
    route_coordinates: list[tuple[float, float]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("id")
    def serialize_id(self, value: object) -> str | None:
        return str(value) if value is not None else None

