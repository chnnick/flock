# Flock

**Find your flock.** A mobile app that connects commuters through matchmaking and chat—whether you're looking for shared hobbies or a commute buddy.

📺 **[Watch the demo](https://www.youtube.com/watch?v=uwQoZG70WvU&feature=youtu.be)** · 📋 **[Devpost](https://devpost.com/software/flock-b6vmnp/)**

---

## Use cases

- **Commute matching** — Get matched with people on your route (transit or walking) by time window and preferences.
- **Group or 1:1** — Choose individual buddies or group commutes; queue-based or suggestion flow.
- **Chat & intros** — In-app chat with AI-generated introductions (Gemini) and conversation prompts.
- **Stay connected** — Add commute friends and keep in touch after the ride.

---

## Tech stack

| Layer | Tech |
|-------|------|
| **Mobile** | React Native, Expo, TypeScript |
| **Backend** | FastAPI (Python), MongoDB (Beanie) |
| **Auth** | **Auth0** — secure login, JWT validation, and user identity across API and app |
| **Maps & routing** | OpenStreetMap, custom transit rendering |
| **AI** | Google Gemini (intros, conversation boost, icebreaker questions) |

**Auth0** is used for sign-in and API protection: the app authenticates with Auth0, and the FastAPI backend validates JWTs and uses the token claims for user-scoped data (commutes, matches, chat rooms).

---

## Project layout

- **`api/`** — FastAPI backend, Auth0 integration, MongoDB, matching & chat services.
- **`mobile/`** — Expo app, screens, and build scripts.

## Setup & run

```bash
npm run setup        # one-time: API venv + pip install, mobile npm install
npm run run:api      # API at http://localhost:8000 (separate terminal)
npm start            # Expo dev server
```

## Clean

```bash
rm -rf api/venv
find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
```
