from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class AlgorithmSettings:
    min_time_overlap_minutes: int = 10
    min_overlap_distance_meters: float = 250.0
    overlap_tolerance_meters: float = 120.0
    overlap_weight: float = 0.7
    interest_weight: float = 0.3
    shared_meters_per_minute: float = 80.0


@dataclass(frozen=True)
class ServiceSettings:
    pass_cooldown_days: int = 7
    queue_assignment_days_ahead: int = 1


@dataclass(frozen=True)
class MatchingSettings:
    algorithm: AlgorithmSettings
    service: ServiceSettings


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_matching_settings(config_path: Path | None = None) -> MatchingSettings:
    path = config_path or (Path(__file__).resolve().parent / "config.yaml")
    payload: dict[str, Any] = {}
    if path.exists():
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            payload = raw

    algorithm_payload = payload.get("algorithm", {})
    service_payload = payload.get("service", {})

    defaults = AlgorithmSettings()
    algorithm = AlgorithmSettings(
        min_time_overlap_minutes=_to_int(
            algorithm_payload.get("min_time_overlap_minutes"),
            defaults.min_time_overlap_minutes,
        ),
        min_overlap_distance_meters=_to_float(
            algorithm_payload.get("min_overlap_distance_meters"),
            defaults.min_overlap_distance_meters,
        ),
        overlap_tolerance_meters=_to_float(
            algorithm_payload.get("overlap_tolerance_meters"),
            defaults.overlap_tolerance_meters,
        ),
        overlap_weight=_to_float(
            algorithm_payload.get("overlap_weight"),
            defaults.overlap_weight,
        ),
        interest_weight=_to_float(
            algorithm_payload.get("interest_weight"),
            defaults.interest_weight,
        ),
        shared_meters_per_minute=_to_float(
            algorithm_payload.get("shared_meters_per_minute"),
            defaults.shared_meters_per_minute,
        ),
    )

    service_defaults = ServiceSettings()
    service = ServiceSettings(
        pass_cooldown_days=_to_int(
            service_payload.get("pass_cooldown_days"),
            service_defaults.pass_cooldown_days,
        ),
        queue_assignment_days_ahead=_to_int(
            service_payload.get("queue_assignment_days_ahead"),
            service_defaults.queue_assignment_days_ahead,
        ),
    )

    return MatchingSettings(algorithm=algorithm, service=service)


MATCHING_SETTINGS = load_matching_settings()

