# Flock

Two-folder layout:

- **`api/`** — Backend (FastAPI, Python). Auth (Auth0), MongoDB, user APIs.
- **`mobile/`** — Frontend (Expo / React Native). App code and build scripts.

## Setup

```bash
make setup          # both api + mobile
# or
make setup-api      # api only (venv + pip install)
make setup-mobile   # mobile only (npm ci in mobile/)
```

## Run

```bash
make run-api        # FastAPI backend on :8000
make run-mobile     # Expo dev server (Metro)
```

## Clean

```bash
make clean   # removes api/venv, node_modules, Python caches
```
