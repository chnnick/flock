# OpenTripPlanner (OTP) Local Setup Guide

This guide is for running OTP locally for Flock and using it as the backend routing engine.

It covers:

- prerequisites
- data preparation (OSM + GTFS)
- building and serving OTP
- querying OTP via GraphQL
- how OTP plugs into Flock backend

## 1) Prerequisites

- Java 21+ installed (OTP2 recommends Java 21 LTS).
- OTP shaded JAR downloaded.
- Local folder to hold OTP data/config.

Example local working directory:

- macOS: `/Users/<you>/otp`

Check Java:

```bash
java -version
```

## 2) Prepare input data

OTP needs:

- GTFS transit feed(s): file name should end with `.zip` and include `gtfs` in the filename.
- OSM street data in `.pbf` format.

Place both in your OTP data directory.

Recommended workflow:

- download regional OSM extract
- crop to your service area (optional but strongly recommended)
- keep only the final extract in the OTP input folder

## 3) Start OTP (quick one-step mode)

From directory containing your OTP JAR:

```bash
java -Xmx2G -jar otp-shaded-<VERSION>.jar --build --serve /Users/<you>/otp
```

Notes:

- Increase `-Xmx` if your dataset is larger.
- Default server port is `8080`.
- When ready, OTP serves local UI and APIs.

## 4) Faster startup mode (build once, then load)

Build and save graph:

```bash
java -Xmx2G -jar otp-shaded-<VERSION>.jar --build --save /Users/<you>/otp
```

Start from saved graph:

```bash
java -Xmx2G -jar otp-shaded-<VERSION>.jar --load /Users/<you>/otp
```

This is better for repeated local runs.

## 5) Query OTP via GraphQL

OTP exposes a GraphQL API. Use this to request itineraries from origin to destination.

Minimal query shape (adapted for local testing):

```graphql
{
  plan(
    from: {
      location: { coordinate: { latitude: 45.5552, longitude: -122.6534 } }
    }
    to: {
      location: { coordinate: { latitude: 45.4908, longitude: -122.5519 } }
    }
    dateTime: { earliestDeparture: "2026-02-14T08:30-08:00" }
    modes: {
      direct: [WALK]
      transit: { transit: [{ mode: BUS }, { mode: RAIL }] }
    }
  ) {
    edges {
      node {
        start
        end
        legs {
          mode
          from { name lat lon }
          to { name lat lon }
          route { gtfsId longName shortName }
          legGeometry { points }
        }
      }
    }
  }
}
```

Important fields for Flock:

- `legs[].mode`
- `legs[].from / to`
- `legs[].route.shortName` (transit line label)
- `legs[].legGeometry.points` (decode polyline to coordinates)

## 6) Flock integration points

Use OTP in backend only (not mobile):

1. `api/src/commutes/service.py` on create/update commute.
2. Call OTP GraphQL plan query.
3. Normalize response into:
   - `route_segments` (walk/transit segments + coordinates + labels)
   - `route_coordinates` (flattened polyline points for matching)
4. Persist on `Commute`.
5. Matching algorithm uses stored geometry from DB.
6. Mobile renders backend-provided geometry in map components.

Suggested new backend files:

- `api/src/routing/otp_client.py`
- `api/src/routing/service.py`

## 7) Backend config to add

Add to backend env/config:

- `OTP_BASE_URL` (example: `http://localhost:8080`)
- optional:
  - OTP request timeout
  - default routing modes
  - max itineraries / preference knobs

## 8) Failure behavior (recommended)

Decide and implement one policy:

- Strict: commute save fails when OTP route generation fails.
- Lenient: commute saves but remains non-matchable until route generation succeeds.

For local demo, strict mode is usually simpler to reason about.

## 9) Local validation checklist

- OTP server starts and responds.
- GraphQL route query returns legs + geometry.
- Creating/updating a commute in Flock stores route geometry.
- Matching run uses stored coordinates and generates matches.
- Mobile map displays backend route segments.

## References

- OTP Basic Tutorial: https://docs.opentripplanner.org/en/latest/Basic-Tutorial/
- OTP GraphQL Tutorial: https://docs.opentripplanner.org/en/latest/apis/GraphQL-Tutorial/

