from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from src.config import settings
from src.routing.otp_client import OtpClient, OtpClientError


class RouteGenerationError(RuntimeError):
    pass


@dataclass(frozen=True)
class NormalizedRouteGeometry:
    route_segments: list[dict[str, Any]]
    route_coordinates: list[tuple[float, float]]


def _decode_polyline(encoded: str) -> list[tuple[float, float]]:
    coordinates: list[tuple[float, float]] = []
    index = 0
    lat = 0
    lng = 0
    length = len(encoded)

    while index < length:
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


def _normalize_route_response(response_data: dict[str, Any]) -> NormalizedRouteGeometry:
    plan = response_data.get("plan")
    if not isinstance(plan, dict):
        raise RouteGenerationError("OTP response did not include a plan")

    edges = plan.get("edges")
    if not isinstance(edges, list) or not edges:
        raise RouteGenerationError("OTP did not return any itinerary")

    first_edge = edges[0] if isinstance(edges[0], dict) else None
    node = first_edge.get("node") if isinstance(first_edge, dict) else None
    legs = node.get("legs") if isinstance(node, dict) else None
    if not isinstance(legs, list) or not legs:
        raise RouteGenerationError("OTP itinerary did not include legs")

    route_segments: list[dict[str, Any]] = []
    route_coordinates: list[tuple[float, float]] = []
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
            else route_short_name if isinstance(route_short_name, str) and route_short_name else None
        )
        transit_line = route_short_name if segment_type == "transit" else None

        route_segments.append(
            {
                "type": segment_type,
                "coordinates": coordinates,
                "label": label,
                "transit_line": transit_line,
            }
        )
        for coordinate in coordinates:
            if not route_coordinates or route_coordinates[-1] != coordinate:
                route_coordinates.append(coordinate)

    if not route_segments or len(route_coordinates) < 2:
        raise RouteGenerationError("OTP returned no usable route geometry")

    return NormalizedRouteGeometry(
        route_segments=route_segments,
        route_coordinates=route_coordinates,
    )


async def generate_route_for_commute(
    *,
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    start_minute: int,
    transport_mode: str,
) -> NormalizedRouteGeometry:
    if not settings.OTP_BASE_URL:
        raise RouteGenerationError("OTP is not configured. Set OTP_BASE_URL.")

    client = OtpClient(
        base_url=settings.OTP_BASE_URL,
        graphql_path=settings.OTP_GRAPHQL_PATH,
        timeout_seconds=settings.OTP_TIMEOUT_SECONDS,
    )
    departure_iso = _build_departure_iso(start_minute)
    try:
        otp_response = await client.plan_route(
            from_lat=start_lat,
            from_lng=start_lng,
            to_lat=end_lat,
            to_lng=end_lng,
            departure_iso=departure_iso,
            transport_mode=transport_mode,
        )
    except OtpClientError as exc:
        raise RouteGenerationError(str(exc)) from exc

    return _normalize_route_response(otp_response)

