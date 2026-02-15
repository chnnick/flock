from __future__ import annotations

import asyncio
import json
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class OtpClientError(RuntimeError):
    pass


def _mode_block(transport_mode: str) -> str:
    if transport_mode == "walk":
        return "direct: [WALK]"
    return (
        "direct: [WALK]\n"
        "      transit: { transit: [{ mode: BUS }, { mode: RAIL }, { mode: TRAM }] }"
    )


def _build_plan_query_v2(
    *,
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    departure_iso: str,
    transport_mode: str,
) -> str:
    modes = _mode_block(transport_mode)
    return f"""
{{
  plan(
    from: {{
      location: {{ coordinate: {{ latitude: {from_lat}, longitude: {from_lng} }} }}
    }}
    to: {{
      location: {{ coordinate: {{ latitude: {to_lat}, longitude: {to_lng} }} }}
    }}
    dateTime: {{ earliestDeparture: "{departure_iso}" }}
    modes: {{
      {modes}
    }}
  ) {{
    edges {{
      node {{
        legs {{
          mode
          duration
          route {{ longName shortName }}
          legGeometry {{ points }}
        }}
      }}
    }}
  }}
}}
""".strip()


def _build_transport_modes_block(transport_mode: str) -> str:
    if transport_mode == "walk":
        return "{ mode: WALK }"
    return "{ mode: WALK }, { mode: TRANSIT }"


def _departure_iso_to_legacy_fields(departure_iso: str) -> tuple[str, str]:
    parsed = datetime.fromisoformat(departure_iso)
    return parsed.strftime("%Y-%m-%d"), parsed.strftime("%I:%M%p").lower()


def _build_plan_query_v1(
    *,
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    departure_iso: str,
    transport_mode: str,
) -> str:
    date, time = _departure_iso_to_legacy_fields(departure_iso)
    transport_modes = _build_transport_modes_block(transport_mode)
    return f"""
{{
  plan(
    from: {{ lat: {from_lat}, lon: {from_lng} }}
    to: {{ lat: {to_lat}, lon: {to_lng} }}
    date: "{date}"
    time: "{time}"
    numItineraries: 1
    transportModes: [{transport_modes}]
  ) {{
    itineraries {{
      duration
      legs {{
        mode
        duration
        route {{ longName shortName }}
        legGeometry {{ points }}
      }}
    }}
  }}
}}
""".strip()


class OtpClient:
    def __init__(self, *, base_url: str, graphql_path: str, timeout_seconds: float) -> None:
        normalized_base = base_url.rstrip("/")
        normalized_path = graphql_path if graphql_path.startswith("/") else f"/{graphql_path}"
        self.endpoint = f"{normalized_base}{normalized_path}"
        self.timeout_seconds = timeout_seconds

    async def plan_route(
        self,
        *,
        from_lat: float,
        from_lng: float,
        to_lat: float,
        to_lng: float,
        departure_iso: str,
        transport_mode: str,
    ) -> dict:
        payload_v2 = {
            "query": _build_plan_query_v2(
                from_lat=from_lat,
                from_lng=from_lng,
                to_lat=to_lat,
                to_lng=to_lng,
                departure_iso=departure_iso,
                transport_mode=transport_mode,
            )
        }
        response_json = await asyncio.to_thread(self._post_graphql, payload_v2)
        if response_json.get("errors"):
            payload_v1 = {
                "query": _build_plan_query_v1(
                    from_lat=from_lat,
                    from_lng=from_lng,
                    to_lat=to_lat,
                    to_lng=to_lng,
                    departure_iso=departure_iso,
                    transport_mode=transport_mode,
                )
            }
            fallback_json = await asyncio.to_thread(self._post_graphql, payload_v1)
            if fallback_json.get("errors"):
                raise OtpClientError(f"OTP returned errors: {fallback_json['errors']}")
            response_json = fallback_json
        data = response_json.get("data")
        if not isinstance(data, dict):
            raise OtpClientError("OTP returned an invalid GraphQL response")
        return data

    def _post_graphql(self, payload: dict) -> dict:
        body = json.dumps(payload).encode("utf-8")
        request = Request(
            self.endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            raise OtpClientError(
                f"OTP request failed with status {exc.code}: {details[:300]}"
            ) from exc
        except URLError as exc:
            raise OtpClientError(f"OTP request failed: {exc.reason}") from exc

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise OtpClientError("OTP returned non-JSON content") from exc

        if not isinstance(parsed, dict):
            raise OtpClientError("OTP returned a malformed JSON payload")
        return parsed

