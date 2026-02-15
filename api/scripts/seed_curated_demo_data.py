from __future__ import annotations

import argparse
import asyncio
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

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


def _m(hour: int, minute: int) -> int:
    return (hour * 60) + minute


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
            else route_short_name
            if isinstance(route_short_name, str) and route_short_name
            else "Walk segment"
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


def _commute_doc(
    *,
    user_auth0_id: str,
    start_name: str,
    start: tuple[float, float],
    end_name: str,
    end: tuple[float, float],
    start_minute: int,
    end_minute: int,
    transport_mode: str,
    match_preference: str,
    group_size_min: int,
    group_size_max: int,
    route_segments: list[dict],
    route_coordinates: list[tuple[float, float]],
    otp_total_duration_minutes: int,
) -> dict:
    return {
        "user_auth0_id": user_auth0_id,
        "start": {"name": start_name, "lat": start[0], "lng": start[1]},
        "end": {"name": end_name, "lat": end[0], "lng": end[1]},
        "time_window": {"start_minute": start_minute, "end_minute": end_minute},
        "transport_mode": transport_mode,
        "match_preference": match_preference,
        "group_size_pref": {"min": group_size_min, "max": group_size_max},
        "gender_preference": "any",
        "status": "paused",
        "enable_queue_flow": False,
        "enable_suggestions_flow": True,
        "queue_days_of_week": [0, 1, 2, 3, 4],
        "route_segments": route_segments,
        "route_coordinates": route_coordinates,
        "otp_total_duration_minutes": otp_total_duration_minutes,
    }


def _route_coordinates_from_segments(route_segments: list[dict]) -> list[tuple[float, float]]:
    route_coordinates: list[tuple[float, float]] = []
    for segment in route_segments:
        coordinates = segment.get("coordinates") if isinstance(segment, dict) else None
        if not isinstance(coordinates, list):
            continue
        for coordinate in coordinates:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) != 2:
                continue
            point = (float(coordinate[0]), float(coordinate[1]))
            if not route_coordinates or route_coordinates[-1] != point:
                route_coordinates.append(point)
    if len(route_coordinates) < 2:
        raise RuntimeError("Route segments did not include enough coordinates")
    return route_coordinates


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a small curated demo dataset for auth0|demo_you")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing users/commutes for these demo users before upserting",
    )
    args = parser.parse_args()

    settings = SeedSettings()
    if not settings.OTP_BASE_URL:
        raise RuntimeError("OTP_BASE_URL is required for curated demo seed route generation")
    now = datetime.now(timezone.utc)
    otp_client = OtpClient(
        base_url=settings.OTP_BASE_URL,
        graphql_path=settings.OTP_GRAPHQL_PATH,
        timeout_seconds=settings.OTP_TIMEOUT_SECONDS,
    )

    me = settings.DEV_AUTH_DEFAULT_USER_ID
    users = [
        {
            "auth0_id": me,
            "name": "Nich Chen",
            "occupation": "Software Engineer",
            "gender": "other",
            "interests": ["Coffee", "Transit", "Running", "Tech"],
        },
        {
            "auth0_id": "auth0|demo_walk_buddy",
            "name": "Maya Rivera",
            "occupation": "Urban Planner",
            "gender": "women",
            "interests": ["Coffee", "Walking", "Art", "Tech"],
        },
        {
            "auth0_id": "auth0|demo_walk_buddy_two",
            "name": "Lena Ortiz",
            "occupation": "Program Manager",
            "gender": "women",
            "interests": ["Coffee", "Running", "Design", "Music"],
        },
        {
            "auth0_id": "auth0|demo_transit_buddy",
            "name": "Noah Chen",
            "occupation": "Data Analyst",
            "gender": "men",
            "interests": ["Transit", "Coffee", "Running", "Tech"],
        },
        {
            "auth0_id": "auth0|demo_transit_walk_buddy",
            "name": "Ari Park",
            "occupation": "Operations Manager",
            "gender": "other",
            "interests": ["Walking", "Transit", "Coffee", "Tech"],
        },
        {
            "auth0_id": "auth0|demo_group_a",
            "name": "Priya Patel",
            "occupation": "Graduate Student",
            "gender": "women",
            "interests": ["Transit", "Coffee", "Running", "Tech"],
        },
        {
            "auth0_id": "auth0|demo_group_b",
            "name": "Evan Brooks",
            "occupation": "Consultant",
            "gender": "men",
            "interests": ["Transit", "Coffee", "Tech", "Music"],
        },
        {
            "auth0_id": "auth0|demo_non_match_far",
            "name": "Sky Kim",
            "occupation": "Teacher",
            "gender": "other",
            "interests": ["Hiking", "Cooking", "Movies"],
        },
    ]
    user_ids = [user["auth0_id"] for user in users]

    commute_specs = [
        {
            "user_auth0_id": me,
            "start_name": "Back Bay Station",
            "start": (42.3473, -71.0757),
            "end_name": "North Station",
            "end": (42.3656, -71.0616),
            "start_minute": _m(8, 5),
            "end_minute": _m(8, 55),
            "transport_mode": "transit",
            "match_preference": "both",
            "group_size_min": 2,
            "group_size_max": 4,
            "route_segments": [
                {
                    "type": "walk",
                    "coordinates": [(42.3473, -71.0757), (42.3525, -71.0626)],
                    "label": "Walk to Chinatown",
                    "transit_line": None,
                    "duration_minutes": 12,
                },
                {
                    "type": "transit",
                    "coordinates": [(42.3525, -71.0626), (42.3656, -71.0616)],
                    "label": "Orange Line to North Station",
                    "transit_line": "Orange Line",
                    "duration_minutes": 10,
                },
                {
                    "type": "walk",
                    "coordinates": [(42.3656, -71.0616), (42.3668, -71.0589)],
                    "label": "Walk to office",
                    "transit_line": None,
                    "duration_minutes": 6,
                },
            ],
            "otp_total_duration_minutes": 28,
        },
        {
            "user_auth0_id": "auth0|demo_walk_buddy",
            "start_name": "Fenway",
            "start": (42.3440, -71.1007),
            "end_name": "Downtown Crossing",
            "end": (42.3555, -71.0605),
            "start_minute": _m(8, 0),
            "end_minute": _m(8, 50),
            "transport_mode": "walk",
            "match_preference": "individual",
            "group_size_min": 2,
            "group_size_max": 2,
        },
        {
            "user_auth0_id": "auth0|demo_walk_buddy_two",
            "start_name": "South End",
            "start": (42.3412, -71.0756),
            "end_name": "Downtown Crossing",
            "end": (42.3555, -71.0605),
            "start_minute": _m(8, 7),
            "end_minute": _m(8, 52),
            "transport_mode": "walk",
            "match_preference": "individual",
            "group_size_min": 2,
            "group_size_max": 2,
        },
        {
            "user_auth0_id": "auth0|demo_transit_buddy",
            "start_name": "Back Bay Station",
            "start": (42.3473, -71.0757),
            "end_name": "Haymarket",
            "end": (42.3630, -71.0583),
            "start_minute": _m(8, 8),
            "end_minute": _m(9, 0),
            "transport_mode": "transit",
            "match_preference": "individual",
            "group_size_min": 2,
            "group_size_max": 2,
            "route_segments": [
                {
                    "type": "walk",
                    "coordinates": [(42.3473, -71.0757), (42.3525, -71.0626)],
                    "label": "Walk to Chinatown",
                    "transit_line": None,
                    "duration_minutes": 12,
                },
                {
                    "type": "transit",
                    "coordinates": [(42.3525, -71.0626), (42.3656, -71.0616)],
                    "label": "Orange Line to North Station",
                    "transit_line": "Orange Line",
                    "duration_minutes": 10,
                },
                {
                    "type": "walk",
                    "coordinates": [(42.3656, -71.0616), (42.3630, -71.0583)],
                    "label": "Walk to Haymarket",
                    "transit_line": None,
                    "duration_minutes": 6,
                },
            ],
            "otp_total_duration_minutes": 28,
        },
        {
            "user_auth0_id": "auth0|demo_transit_walk_buddy",
            "start_name": "Back Bay Station",
            "start": (42.3473, -71.0757),
            "end_name": "Boston Common",
            "end": (42.3550, -71.0655),
            "start_minute": _m(8, 7),
            "end_minute": _m(8, 52),
            "transport_mode": "transit",
            "match_preference": "individual",
            "group_size_min": 2,
            "group_size_max": 2,
            "route_segments": [
                {
                    "type": "walk",
                    "coordinates": [(42.3473, -71.0757), (42.3525, -71.0626)],
                    "label": "Walk to Chinatown",
                    "transit_line": None,
                    "duration_minutes": 12,
                },
                {
                    "type": "transit",
                    "coordinates": [(42.3525, -71.0626), (42.3533, -71.0650)],
                    "label": "Green Line to Boylston",
                    "transit_line": "Green Line",
                    "duration_minutes": 4,
                },
                {
                    "type": "walk",
                    "coordinates": [(42.3533, -71.0650), (42.3550, -71.0655)],
                    "label": "Walk to destination",
                    "transit_line": None,
                    "duration_minutes": 3,
                },
            ],
            "otp_total_duration_minutes": 19,
        },
        {
            "user_auth0_id": "auth0|demo_group_a",
            "start_name": "Copley",
            "start": (42.3498, -71.0773),
            "end_name": "Haymarket",
            "end": (42.3630, -71.0583),
            "start_minute": _m(8, 6),
            "end_minute": _m(8, 56),
            "transport_mode": "transit",
            "match_preference": "group",
            "group_size_min": 3,
            "group_size_max": 4,
            "route_segments": [
                {
                    "type": "walk",
                    "coordinates": [(42.3498, -71.0773), (42.3525, -71.0626)],
                    "label": "Walk to Chinatown",
                    "transit_line": None,
                    "duration_minutes": 11,
                },
                {
                    "type": "transit",
                    "coordinates": [(42.3525, -71.0626), (42.3656, -71.0616)],
                    "label": "Orange Line to North Station",
                    "transit_line": "Orange Line",
                    "duration_minutes": 10,
                },
                {
                    "type": "walk",
                    "coordinates": [(42.3656, -71.0616), (42.3630, -71.0583)],
                    "label": "Walk to Haymarket",
                    "transit_line": None,
                    "duration_minutes": 6,
                },
            ],
            "otp_total_duration_minutes": 27,
        },
        {
            "user_auth0_id": "auth0|demo_group_b",
            "start_name": "Back Bay Station",
            "start": (42.3473, -71.0757),
            "end_name": "Government Center",
            "end": (42.3597, -71.0592),
            "start_minute": _m(8, 9),
            "end_minute": _m(8, 54),
            "transport_mode": "transit",
            "match_preference": "group",
            "group_size_min": 3,
            "group_size_max": 4,
            "route_segments": [
                {
                    "type": "walk",
                    "coordinates": [(42.3473, -71.0757), (42.3525, -71.0626)],
                    "label": "Walk to Chinatown",
                    "transit_line": None,
                    "duration_minutes": 12,
                },
                {
                    "type": "transit",
                    "coordinates": [(42.3525, -71.0626), (42.3656, -71.0616)],
                    "label": "Orange Line to North Station",
                    "transit_line": "Orange Line",
                    "duration_minutes": 10,
                },
                {
                    "type": "walk",
                    "coordinates": [(42.3656, -71.0616), (42.3597, -71.0592)],
                    "label": "Walk to Government Center",
                    "transit_line": None,
                    "duration_minutes": 8,
                },
            ],
            "otp_total_duration_minutes": 30,
        },
        {
            "user_auth0_id": "auth0|demo_non_match_far",
            "start_name": "Seaport",
            "start": (42.3482, -71.0385),
            "end_name": "Fan Pier",
            "end": (42.3445, -71.0250),
            "start_minute": _m(8, 20),
            "end_minute": _m(8, 50),
            "transport_mode": "walk",
            "match_preference": "individual",
            "group_size_min": 2,
            "group_size_max": 2,
        },
    ]
    route_cache: dict[tuple, tuple[list[dict], list[tuple[float, float]], int]] = {}
    commutes: list[dict] = []
    for spec in commute_specs:
        manual_segments = spec.get("route_segments")
        manual_duration = spec.get("otp_total_duration_minutes")
        if isinstance(manual_segments, list) and isinstance(manual_duration, int):
            route_segments = manual_segments
            route_coordinates = _route_coordinates_from_segments(route_segments)
            otp_total_duration_minutes = manual_duration
        else:
            route_key = (
                round(spec["start"][0], 6),
                round(spec["start"][1], 6),
                round(spec["end"][0], 6),
                round(spec["end"][1], 6),
                int(spec["start_minute"]),
                str(spec["transport_mode"]),
            )
            if route_key not in route_cache:
                route_cache[route_key] = asyncio.run(
                    _fetch_route_from_otp(
                        otp_client=otp_client,
                        start=spec["start"],
                        end=spec["end"],
                        start_minute=spec["start_minute"],
                        transport_mode=spec["transport_mode"],
                    )
                )
            route_segments, route_coordinates, otp_total_duration_minutes = route_cache[route_key]
        computed_end_minute = max(spec["end_minute"], spec["start_minute"] + otp_total_duration_minutes)
        commutes.append(
            _commute_doc(
                user_auth0_id=spec["user_auth0_id"],
                start_name=spec["start_name"],
                start=spec["start"],
                end_name=spec["end_name"],
                end=spec["end"],
                start_minute=spec["start_minute"],
                end_minute=min(1440, computed_end_minute),
                transport_mode=spec["transport_mode"],
                match_preference=spec["match_preference"],
                group_size_min=spec["group_size_min"],
                group_size_max=spec["group_size_max"],
                route_segments=route_segments,
                route_coordinates=route_coordinates,
                otp_total_duration_minutes=otp_total_duration_minutes,
            )
        )

    client = MongoClient(settings.MONGO_URI, server_api=pymongo.server_api.ServerApi(version="1"))
    db = client.get_database("commutebuddy")

    if args.reset:
        db.commutes.delete_many({"user_auth0_id": {"$in": user_ids}})
        db.users.delete_many({"auth0_id": {"$in": user_ids}})

    existing_matches = list(
        db.matches.find({"participants": {"$in": user_ids}}, {"_id": 1})
    )
    match_ids = [str(item["_id"]) for item in existing_matches]
    if match_ids:
        db.chat_messages.delete_many({"chat_room_id": {"$in": [str(room["_id"]) for room in db.chat_rooms.find({"match_id": {"$in": match_ids}}, {"_id": 1})]}})
        db.chat_rooms.delete_many({"match_id": {"$in": match_ids}})
    db.matches.delete_many({"participants": {"$in": user_ids}})

    user_ops = [
        UpdateOne(
            {"auth0_id": user["auth0_id"]},
            {"$set": {**user, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        for user in users
    ]
    commute_ops = [
        UpdateOne(
            {"user_auth0_id": commute["user_auth0_id"]},
            {"$set": {**commute, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        for commute in commutes
    ]

    if user_ops:
        db.users.bulk_write(user_ops, ordered=False)
    if commute_ops:
        db.commutes.bulk_write(commute_ops, ordered=False)

    print("Curated demo seed complete")
    print(f"users upserted: {len(users)}")
    print(f"commutes upserted: {len(commutes)}")
    print("matches inserted: 0 (generated by UI matching trigger)")
    print(f"default demo user: {me}")
    print("commutes queued: 0 (all seeded as paused)")
    print(f"unique OTP route fetches: {len(route_cache)}")


if __name__ == "__main__":
    main()

