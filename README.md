# Flock

Two-folder layout:

- **`api/`** — Backend (FastAPI, Python). Auth (Auth0), MongoDB, user APIs.
- **`mobile/`** — Frontend (Expo / React Native). App code and build scripts.

## Setup

```bash
# API (from repo root)
cd api && python3 -m venv venv && venv/bin/pip install -r requirements.txt

# Mobile (from repo root; also runs postinstall)
npm install
```

## Run

```bash
npm run run:api     # FastAPI on http://localhost:8000 (macOS/Linux; requires api/venv)
npm start           # Expo dev server (or: npm run run:mobile)
```

Run API and mobile in separate terminals.

## Clean

```bash
rm -rf api/venv
find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
```
