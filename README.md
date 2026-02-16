# Flock

**Find your flock.** A mobile app that connects commuters through matchmaking and chat—whether you're looking for shared hobbies or a commute buddy.

📺 **[Watch the demo](https://www.youtube.com/watch?v=uwQoZG70WvU&feature=youtu.be)** · 📋 **[Devpost](https://devpost.com/software/flock-b6vmnp/)**

---

<div align="center">
  <img width="200" alt="Landing Page of Flock" src="https://github.com/user-attachments/assets/273d8197-2625-4a93-a827-4ed58ffa427e" />
  <img width="200" alt="Login Page of Flock" src="https://github.com/user-attachments/assets/f29f8a2f-69c6-4223-b8a0-10a3be8a8f67" />
  <img width="200" alt="Matches Screen Page of Flock" src="https://github.com/user-attachments/assets/ee7f60e8-b25f-4199-a82b-640c63ec83d2" />
  <img width="200" alt="Chat Page with Gemini of Flock" src="https://github.com/user-attachments/assets/93e24360-44a0-47b5-9aba-2692bbb477d4" />
  <img width="200" alt="Shared Commute with Flock" src="https://github.com/user-attachments/assets/9d3b7b73-3578-4f79-95bf-09dcb60a7d0c" />
</div>

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
| **Matching, Maps, routing** | Custom matching algorithm, OpenStreetMap mapping, custom transit rendering |
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
