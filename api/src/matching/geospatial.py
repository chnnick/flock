from __future__ import annotations

from dataclasses import dataclass
from math import atan2, cos, radians, sin, sqrt


@dataclass(frozen=True)
class OverlapPoint:
    lat: float
    lng: float


@dataclass(frozen=True)
class OverlapSegment:
    meet_point: OverlapPoint
    split_point: OverlapPoint
    overlap_distance_meters: float


def haversine_meters(point_a: tuple[float, float], point_b: tuple[float, float]) -> float:
    earth_radius_meters = 6_371_000
    lat1, lng1 = point_a
    lat2, lng2 = point_b
    lat1_r, lng1_r = radians(lat1), radians(lng1)
    lat2_r, lng2_r = radians(lat2), radians(lng2)
    delta_lat = lat2_r - lat1_r
    delta_lng = lng2_r - lng1_r

    value = (
        sin(delta_lat / 2) ** 2
        + cos(lat1_r) * cos(lat2_r) * sin(delta_lng / 2) ** 2
    )
    return 2 * earth_radius_meters * atan2(sqrt(value), sqrt(1 - value))


def polyline_length_meters(points: list[tuple[float, float]]) -> float:
    if len(points) < 2:
        return 0.0
    total = 0.0
    for index in range(1, len(points)):
        total += haversine_meters(points[index - 1], points[index])
    return total


def route_overlap_segment(
    left_route: list[tuple[float, float]],
    right_route: list[tuple[float, float]],
    *,
    tolerance_meters: float,
) -> OverlapSegment | None:
    if not left_route or not right_route:
        return None

    matched_points: list[tuple[float, float]] = []
    for point in left_route:
        if any(haversine_meters(point, other) <= tolerance_meters for other in right_route):
            matched_points.append(point)

    if len(matched_points) < 2:
        return None

    overlap_distance = polyline_length_meters(matched_points)
    if overlap_distance <= 0:
        return None

    meet_lat, meet_lng = matched_points[0]
    split_lat, split_lng = matched_points[-1]
    return OverlapSegment(
        meet_point=OverlapPoint(lat=meet_lat, lng=meet_lng),
        split_point=OverlapPoint(lat=split_lat, lng=split_lng),
        overlap_distance_meters=overlap_distance,
    )

