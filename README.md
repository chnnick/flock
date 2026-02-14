# Flock

Two-folder layout:

- **`api/`** — Backend (FastAPI, Python). Auth (Auth0), MongoDB, user APIs.
- **`mobile/`** — Frontend (Expo / React Native). App code and build scripts.

## Setup

From repo root (one-time after clone):

```bash
npm run setup        # API venv + pip install, then mobile npm install + patch-package
```

Or step by step:

```bash
npm run setup:api    # api/venv + pip install -r requirements.txt
npm run setup:mobile # npm install (installs mobile deps via postinstall)
```

## Run

```bash
npm run run:api     # FastAPI on http://flock.mzhang.dev:8777 (via Nginx proxying 8007)
npm start           # Expo dev server (or: npm run run:mobile)
```

Run API and mobile in separate terminals.

## Clean

```bash
rm -rf api/venv
find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
```
