# Real-time Chat Flow Documentation

This document outlines the end-to-end flow of the real-time chat system in the Flock application, from app startup to message storage and AI integration.

---

### 1. App Startup & Data Initialization
When the mobile app is launched, the `AppProvider` in `mobile/contexts/AppContext.tsx` initializes the state.

1.  **Hydration**: `loadData()` is called, which pulls the following from local `AsyncStorage`:
    *   `flock_user`: Current user's profile and ID (generated via `Crypto.randomUUID()` on onboarding).
    *   `flock_chats`: Existing chat room metadata and message history.
2.  **State Management**: This data is loaded into `chatRooms`, `user`, and `matches` states.
3.  **Connection Preparation**: The `useEffect` hook monitoring `chatRooms` prepares to establish WebSocket connections for every active room.

---

### 2. Match Acceptance & Chat Room Creation
Before a chat starts, a match must be accepted.

1.  **Action**: User clicks "Accept" on a match.
2.  **Room Generation**: 
    *   A unique `chatRoomId` is assigned to the match.
    *   An initial "System" message (Icebreaker) is generated locally.
    *   The `ChatRoom` object is created and saved to `AsyncStorage`.
3.  **Trigger**: Updating the `chatRooms` state triggers the WebSocket connection effect.

---

### 3. WebSocket Connection (Handshake)
The app maintains a persistent connection for every active chat room.

1.  **URL Mapping**: The app determines the server host based on the platform:
    *   **Android Emulator**: `10.0.2.2`
    *   **iOS/Web**: `localhost`
    *   **URL**: ` ews://[host]:8000/api/chat/ws/chat/[room_id]`
2.  **Server Connection**: The FastAPI backend (`api/src/chat/router.py`) accepts the connection via `ConnectionManager`.
3.  **History Sync**: Immediately upon connection, the server:
    *   Calls `ChatService.get_recent_messages(room_id)`.
    *   Attempts to fetch the latest 50 messages from **Redis**.
    *   If Redis is empty, it falls back to **MongoDB**.
    *   Sends a `{"type": "history", "messages": [...]}` payload to the client.
4.  **Client Update**: The mobile app receives the history and replaces its local message list for that room to ensure synchronization.

---

### 4. Real-time Messaging Flow
When a user sends a message, the following sequence occurs:

1.  **Client Send**: 
    *   `sendMessage(roomId, text)` is called.
    *   The app checks if the WebSocket for that room is open.
    *   If closed, it attempts a lazy reconnection.
    *   The message is sent as a JSON string: `{"sender_id": "...", "sender_name": "...", "body": "..."}`.
2.  **Server Process**: 
    *   The backend receives the text and parses it into a `MessageCreate` schema.
3.  **Persistence & Caching**: 
    *   **MongoDB**: The message is saved permanently using Beanie/Motor.
    *   **Redis**: The message is cached using `LPUSH` into a room-specific list (`chat:room:[id]:recent`).
    *   **Trimming**: `LTRIM` is called to keep only the latest 50 messages in Redis, keeping the cache lean.
4.  **Broadcasting**: 
    *   The server broadcasts the saved message (now including a server-side timestamp and unique ID) to **all** active WebSockets in that room.
5.  **Client Receive**: 
    *   The app receives `{"type": "message", "message": {...}}`.
    *   It updates the `chatRooms` state, which causes the chat UI (`mobile/app/chat/[id].tsx`) to re-render and show the new bubble.

---

### 5. Gemini AI Integration (Bubbly Interventions)
After every user message, the system checks if it needs to intervene.

1.  **Background Task**: The server spawns an asynchronous `gemini_check()` task.
2.  **Context Gathering**: It retrieves the last 5 messages for the room.
3.  **Analysis**: The `GeminiClient` sends these messages to the `gemini-2.0-flash` model with instructions to detect "dryness".
4.  **Response**: 
    *   If the conversation is "flowing", Gemini returns "FLOWING" and the task ends.
    *   If the conversation is stalling, Gemini generates a bubbly, enthusiastic intervention.
5.  **AI Message Injection**: 
    *   The AI's response is saved to MongoDB and Redis as a "system" style message.
    *   It is broadcasted over the WebSocket just like a normal user message.
    *   The client displays it with the name "Flock Bubbly Guide".

---

### 6. Summary of Data Storage
| Component | Purpose | Technology |
| :--- | :--- | :--- |
| **Local Client** | UI State & Offline Cache | React State & AsyncStorage |
| **Hot Cache** | Rapid History Sync & Gemini Context | Redis (`LPUSH`/`LTRIM`) |
| **Permanent Store**| Long-term History & User Data | MongoDB (Beanie ODM) |
