### Real-Time Chat Implementation Summary

This document summarizes the real-time chat system implemented using WebSockets, FastAPI, Redis, and MongoDB, including AI-powered conversation guidance.

### Architecture Overview

The system uses a hybrid storage approach to balance performance and persistence:
1.  **WebSockets**: For real-time, bidirectional communication between clients and the server.
2.  **Redis**: Acts as a high-speed cache for the latest 50 messages in each chat room, ensuring rapid delivery of recent history upon connection.
3.  **MongoDB (Beanie)**: Provides permanent storage for all chat messages and room metadata.
4.  **Google Gemini API**: Automatically monitors conversations to provide "bubbly" interventions if the chat becomes dry.

---

### Backend Implementation (FastAPI)

#### 1. Data Models (`api/src/db/models/chat.py`)
- `ChatMessage`: Stores `sender_id`, `body`, `timestamp`, and room association.
- `ChatRoom`: Manages participants and room status.
- Integrated into the `init_db` process in `api/src/db/mongodb.py`.

#### 2. Chat Service (`api/src/chat/service.py`)
- **`save_message`**: Saves to MongoDB and simultaneously pushes to a Redis List (`LPUSH`). It uses `LTRIM` to keep only the latest 50 messages in cache.
- **`get_recent_messages`**: Attempts to fetch from Redis first (very fast). If the cache is empty, it falls back to MongoDB.

#### 3. WebSocket Router (`api/src/chat/router.py`)
- **`ConnectionManager`**: Manages active `WebSocket` objects.
- **Flow**:
    - **Connect**: On connection, the server immediately sends the recent message history fetched from the `ChatService`.
    - **Message**: When a message is received, it is saved via `ChatService` and broadcast to all active participants in the room.
    - **AI Trigger**: After broadcasting, a background task is triggered to check the conversation health using Gemini.

---

### Frontend Implementation (React Native / Expo)

#### 1. AppContext Integration (`mobile/contexts/AppContext.tsx`)
- **Connection Management**: Uses a `useRef` to maintain active WebSocket connections for all chat rooms the user is part of.
- **Auto-Reconnect**: A `useEffect` hook monitors the chat rooms and establishes connections automatically.
- **Real-time Updates**: 
    - Listens for `history` events to populate the chat UI initially.
    - Listens for `message` events to append new messages (from any participant) to the local state in real-time.
- **`sendMessage`**: Updated to transmit data over the WebSocket instead of a standard REST API call.

---

### AI Integration (Gemini)

- **Dryness Detection**: The `GeminiClient` analyzes the last few messages.
- **Bubbly Intervention**: If the AI detects the conversation has stalled, it generates an enthusiastic message with a new question or topic to keep the "mutuals" engaged.
- **System Instructions**: The AI is configured with a specific persona: a bubbly, lively friend who acts as a bridge between users.

---

### Technical Flow

1.  **Handshake**: Client opens WebSocket connection to `/api/chat/ws/chat/{room_id}`.
2.  **History Load**: Server sends recent messages from Redis/Mongo.
3.  **Chatting**: 
    - Client sends JSON message over WS.
    - Server saves to Mongo (permanent) and Redis (cache).
    - Server broadcasts to all participants.
4.  **AI Observation**: Server background task sends history to Gemini; Gemini responds if a "boost" is needed.
