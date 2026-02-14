from __future__ import annotations

import asyncio
import json
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


def _build_plan_query(
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
          route {{ longName shortName }}
          legGeometry {{ points }}
        }}
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
        payload = {
            "query": _build_plan_query(
                from_lat=from_lat,
                from_lng=from_lng,
                to_lat=to_lat,
                to_lng=to_lng,
                departure_iso=departure_iso,
                transport_mode=transport_mode,
            )
        }
        response_json = await asyncio.to_thread(self._post_graphql, payload)
        if response_json.get("errors"):
            raise OtpClientError(f"OTP returned errors: {response_json['errors']}")
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

