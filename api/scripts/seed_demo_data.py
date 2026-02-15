from __future__ import annotations

import argparse
import asyncio
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pymongo
from pymongo import MongoClient, UpdateOne
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from src.routing.otp_client import OtpClient, OtpClientError


class SeedSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "api/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    MONGO_URI: str
    DEV_AUTH_DEFAULT_USER_ID: str = "auth0|demo_you"
    OTP_BASE_URL: str | None = None
    OTP_GRAPHQL_PATH: str = "/otp/routers/default/index/graphql"
    OTP_TIMEOUT_SECONDS: float = 15.0


FIRST_NAMES = [
    "Alex", "Jordan", "Sam", "Taylor", "Casey", "Riley", "Quinn", "Avery", "Drew", "Jamie",
    "Skyler", "Reese", "Blake", "Cameron", "Morgan", "Rowan", "Emerson", "Charlie", "Parker",
]
LAST_NAMES = [
    "Chen", "Rivera", "Parker", "Lee", "Kim", "Brooks", "Patel", "Johnson", "Torres", "Martinez",
    "Williams", "Davis", "Thompson", "Anderson", "Wright", "Clark", "Hall", "Allen", "Young",
]
OCCUPATIONS = [
    "Software Engineer", "Teacher", "Designer", "Nurse", "Product Manager", "Analyst",
    "Researcher", "Consultant", "Writer", "Student",
]
INTERESTS = [
    "Coffee", "Tech", "Running", "Podcasts", "Reading", "Travel", "Music", "Art", "Yoga",
    "Gaming", "Cycling", "Movies", "Cooking", "Hiking",
]


WALK_TEMPLATES = [
    {
        "start_name": "Brookline Village",
        "start": (42.3329, -71.1162),
        "end_name": "Fenway Station",
        "end": (42.3454, -71.1043),
    },
    {
        "start_name": "North End",
        "start": (42.3655, -71.0542),
        "end_name": "South Station",
        "end": (42.3523, -71.0552),
    },
    {
        "start_name": "Back Bay Station",
        "start": (42.3474, -71.0757),
        "end_name": "Copley Square",
        "end": (42.3499, -71.0773),
    },
]

TRANSIT_TEMPLATES = [
    {
        "start_name": "Coolidge Corner",
        "start": (42.3428, -71.1217),
        "end_name": "Downtown Crossing",
        "end": (42.3555, -71.0605),
    },
    {
        "start_name": "JFK/UMass",
        "start": (42.3206, -71.0524),
        "end_name": "North Station",
        "end": (42.3656, -71.0616),
    },
    {
        "start_name": "Forest Hills",
        "start": (42.3005, -71.1137),
        "end_name": "Park Street",
        "end": (42.3564, -71.0623),
    },
]


def _decode_polyline(encoded: str) -> list[tuple[float, float]]:
    coordinates: list[tuple[float, float]] = []
    index = 0
    lat = 0
    lng = 0

    while index < len(encoded):
        shift = 0
        result = 0
        while True:
            value = ord(encoded[index]) - 63
            index += 1
            result |= (value & 0x1F) << shift
            shift += 5
            if value < 0x20:
                break
        delta_lat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += delta_lat

        shift = 0
        result = 0
        while True:
            value = ord(encoded[index]) - 63
            index += 1
            result |= (value & 0x1F) << shift
            shift += 5
            if value < 0x20:
                break
        delta_lng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += delta_lng

        coordinates.append((lat / 1e5, lng / 1e5))

    return coordinates


def _build_departure_iso(start_minute: int) -> str:
    now = datetime.now().astimezone()
    hour, minute = divmod(start_minute, 60)
    departure = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if departure < now:
        departure = departure + timedelta(days=1)
    return departure.isoformat(timespec="minutes")


def _normalize_otp_plan(plan_data: dict) -> tuple[list[dict], list[tuple[float, float]], int]:
    plan = plan_data.get("plan")
    if not isinstance(plan, dict):
        raise RuntimeError("OTP response did not include a plan")

    legs = None
    edges = plan.get("edges")
    if isinstance(edges, list) and edges:
        first_edge = edges[0] if isinstance(edges[0], dict) else None
        node = first_edge.get("node") if isinstance(first_edge, dict) else None
        candidate_legs = node.get("legs") if isinstance(node, dict) else None
        if isinstance(candidate_legs, list):
            legs = candidate_legs
    if legs is None:
        itineraries = plan.get("itineraries")
        if isinstance(itineraries, list) and itineraries:
            first_itinerary = itineraries[0] if isinstance(itineraries[0], dict) else None
            candidate_legs = first_itinerary.get("legs") if isinstance(first_itinerary, dict) else None
            if isinstance(candidate_legs, list):
                legs = candidate_legs
    if not isinstance(legs, list) or not legs:
        raise RuntimeError("OTP itinerary did not include legs")

    def duration_minutes(value: object) -> int | None:
        if isinstance(value, (int, float)):
            return max(1, int(round(float(value) / 60)))
        if isinstance(value, str):
            trimmed = value.strip().upper()
            iso_match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", trimmed)
            if iso_match:
                hours = int(iso_match.group(1) or 0)
                minutes = int(iso_match.group(2) or 0)
                seconds = int(iso_match.group(3) or 0)
                return max(1, int(round((hours * 3600 + minutes * 60 + seconds) / 60)))
            numeric = re.fullmatch(r"\d+(?:\.\d+)?", trimmed)
            if numeric:
                return max(1, int(round(float(trimmed) / 60)))
        return None

    itinerary_duration_minutes: int | None = None
    itineraries = plan.get("itineraries")
    if isinstance(itineraries, list) and itineraries:
        first_itinerary = itineraries[0] if isinstance(itineraries[0], dict) else None
        itinerary_duration_minutes = duration_minutes(
            first_itinerary.get("duration") if isinstance(first_itinerary, dict) else None
        )

    route_segments: list[dict] = []
    route_coordinates: list[tuple[float, float]] = []
    total_duration_minutes = 0
    has_duration = False
    for leg in legs:
        if not isinstance(leg, dict):
            continue
        mode = str(leg.get("mode", "")).upper()
        segment_type = "walk" if mode == "WALK" else "transit"
        geometry = leg.get("legGeometry")
        encoded = geometry.get("points") if isinstance(geometry, dict) else None
        if not isinstance(encoded, str) or not encoded:
            continue

        coordinates = _decode_polyline(encoded)
        if len(coordinates) < 2:
            continue

        route = leg.get("route")
        route_short_name = route.get("shortName") if isinstance(route, dict) else None
        route_long_name = route.get("longName") if isinstance(route, dict) else None
        label = (
            route_long_name
            if isinstance(route_long_name, str) and route_long_name
            else route_short_name if isinstance(route_short_name, str) and route_short_name else "Walk segment"
        )
        transit_line = route_short_name if segment_type == "transit" and isinstance(route_short_name, str) else None
        segment_duration_minutes = duration_minutes(leg.get("duration"))
        if segment_duration_minutes is not None:
            total_duration_minutes += segment_duration_minutes
            has_duration = True
        route_segments.append(
            {
                "type": segment_type,
                "coordinates": coordinates,
                "label": label,
                "transit_line": transit_line,
                "duration_minutes": segment_duration_minutes,
            }
        )
        for coordinate in coordinates:
            if not route_coordinates or route_coordinates[-1] != coordinate:
                route_coordinates.append(coordinate)

    if not route_segments or len(route_coordinates) < 2:
        raise RuntimeError("OTP returned no usable route geometry")

    total_minutes = total_duration_minutes if has_duration else itinerary_duration_minutes
    if total_minutes is None:
        raise RuntimeError("OTP response did not include a usable itinerary duration")
    return route_segments, route_coordinates, total_minutes


async def _fetch_route_from_otp(
    *,
    otp_client: OtpClient,
    start: tuple[float, float],
    end: tuple[float, float],
    start_minute: int,
    transport_mode: str,
) -> tuple[list[dict], list[tuple[float, float]], int]:
    departure_iso = _build_departure_iso(start_minute)
    try:
        response_data = await otp_client.plan_route(
            from_lat=start[0],
            from_lng=start[1],
            to_lat=end[0],
            to_lng=end[1],
            departure_iso=departure_iso,
            transport_mode=transport_mode,
        )
    except OtpClientError as exc:
        raise RuntimeError(f"OTP request failed: {exc}") from exc
    return _normalize_otp_plan(response_data)


def _make_user_doc(auth0_id: str, idx: int, rng: random.Random) -> dict:
    first = FIRST_NAMES[idx % len(FIRST_NAMES)]
    last = LAST_NAMES[(idx * 7) % len(LAST_NAMES)]
    interests = rng.sample(INTERESTS, k=3 + (idx % 3))
    gender = ["men", "women", "other"][idx % 3]
    return {
        "auth0_id": auth0_id,
        "name": f"{first} {last}",
        "occupation": OCCUPATIONS[idx % len(OCCUPATIONS)],
        "gender": gender,
        "interests": interests,
    }


def _make_commute_doc(
    *,
    user_auth0_id: str,
    idx: int,
    otp_client: OtpClient,
    route_cache: dict[tuple, tuple[list[dict], list[tuple[float, float]], int]],
) -> dict:
    cohort = idx % 4
    now = datetime.now(timezone.utc)
    if cohort in (0, 1):
        transport_mode = "walk"
        template = WALK_TEMPLATES[idx % len(WALK_TEMPLATES)]
        start_minute = 450 + (idx % 5) * 3
        match_preference = "individual" if cohort == 0 else "group"
        group_size_pref = {"min": 2, "max": 2} if match_preference == "individual" else {"min": 3, "max": 4}
        status = "queued"
    elif cohort == 2:
        transport_mode = "transit"
        template = TRANSIT_TEMPLATES[idx % len(TRANSIT_TEMPLATES)]
        start_minute = 445 + (idx % 4) * 4
        match_preference = "individual"
        group_size_pref = {"min": 2, "max": 2}
        status = "queued"
    else:
        transport_mode = "walk"
        template = WALK_TEMPLATES[(idx + 1) % len(WALK_TEMPLATES)]
        start_minute = 600
        match_preference = "group"
        group_size_pref = {"min": 3, "max": 4}
        status = "paused"

    cache_key = (
        round(template["start"][0], 6),
        round(template["start"][1], 6),
        round(template["end"][0], 6),
        round(template["end"][1], 6),
        start_minute,
        transport_mode,
    )
    if cache_key not in route_cache:
        route_cache[cache_key] = asyncio.run(
            _fetch_route_from_otp(
                otp_client=otp_client,
                start=template["start"],
                end=template["end"],
                start_minute=start_minute,
                transport_mode=transport_mode,
            )
        )
    route_segments, route_coordinates, otp_total_duration_minutes = route_cache[cache_key]
    end_minute = min(1440, start_minute + otp_total_duration_minutes)

    return {
        "user_auth0_id": user_auth0_id,
        "start": {"name": template["start_name"], "lat": template["start"][0], "lng": template["start"][1]},
        "end": {"name": template["end_name"], "lat": template["end"][0], "lng": template["end"][1]},
        "time_window": {"start_minute": start_minute, "end_minute": end_minute},
        "transport_mode": transport_mode,
        "match_preference": match_preference,
        "group_size_pref": group_size_pref,
        "gender_preference": "any",
        "status": status,
        "enable_queue_flow": True,
        "enable_suggestions_flow": True,
        "queue_days_of_week": [0, 1, 2, 3, 4],
        "route_segments": route_segments,
        "route_coordinates": route_coordinates,
        "otp_total_duration_minutes": otp_total_duration_minutes,
        "updated_at": now,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed deterministic demo users/commutes")
    parser.add_argument("--count", type=int, default=40, help="Total demo users to seed")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--reset", action="store_true", help="Delete existing users/commutes/matches/chats first")
    args = parser.parse_args()

    settings = SeedSettings()
    rng = random.Random(args.seed)
    if not settings.OTP_BASE_URL:
        raise RuntimeError("OTP_BASE_URL is required for realistic seeded route geometry")

    otp_client = OtpClient(
        base_url=settings.OTP_BASE_URL,
        graphql_path=settings.OTP_GRAPHQL_PATH,
        timeout_seconds=settings.OTP_TIMEOUT_SECONDS,
    )
    route_cache: dict[tuple, tuple[list[dict], list[tuple[float, float]], int]] = {}

    client = MongoClient(settings.MONGO_URI, server_api=pymongo.server_api.ServerApi(version="1"))
    db = client.get_database("commutebuddy")

    if args.reset:
        db.chat_messages.delete_many({})
        db.chat_rooms.delete_many({})
        db.matches.delete_many({})
        db.commutes.delete_many({})
        db.users.delete_many({})

    user_ids = [settings.DEV_AUTH_DEFAULT_USER_ID] + [f"auth0|demo_user_{i:03d}" for i in range(max(0, args.count - 1))]

    now = datetime.now(timezone.utc)
    user_ops = []
    commute_ops = []
    for idx, auth0_id in enumerate(user_ids):
        user = _make_user_doc(auth0_id, idx, rng)
        user["updated_at"] = now
        user_ops.append(
            UpdateOne(
                {"auth0_id": auth0_id},
                {"$set": user, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
        )

        commute = _make_commute_doc(
            user_auth0_id=auth0_id,
            idx=idx,
            otp_client=otp_client,
            route_cache=route_cache,
        )
        commute_ops.append(
            UpdateOne(
                {"user_auth0_id": auth0_id},
                {"$set": commute, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
        )

    if user_ops:
        db.users.bulk_write(user_ops, ordered=False)
    if commute_ops:
        db.commutes.bulk_write(commute_ops, ordered=False)

    queued_count = db.commutes.count_documents({"status": "queued"})
    walk_queued = db.commutes.count_documents({"status": "queued", "transport_mode": "walk"})
    transit_queued = db.commutes.count_documents({"status": "queued", "transport_mode": "transit"})

    print("Seed complete")
    print(f"users upserted: {len(user_ids)}")
    print(f"commutes upserted: {len(user_ids)}")
    print(f"queued users: {queued_count}")
    print(f"queued walk: {walk_queued}")
    print(f"queued transit: {transit_queued}")
    print(f"unique OTP route fetches: {len(route_cache)}")
    print(f"default dev user id: {settings.DEV_AUTH_DEFAULT_USER_ID}")


if __name__ == "__main__":
    main()

