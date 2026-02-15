from __future__ import annotations

import asyncio
import json
from typing import Dict, List

from fastapi import APIRouter, HTTPException, status, WebSocket, WebSocketDisconnect

from src.auth.dependencies import AuthenticatedUser
from src.chat.schemas import (
    ContinuationRequest,
    ContinuationResponse,
    IntroductionRequest,
    IntroductionResponse,
    MessageCreate,
    QuestionsRequest,
    QuestionsResponse,
)
from src.chat.service import (
    chat_service,
    get_room_for_user,
    get_room_last_message,
    list_messages_for_room,
    list_rooms_for_user,
)
from src.gemini.gemini import GeminiClient

router = APIRouter()
gemini_client = GeminiClient()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str) -> None:
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str) -> None:
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: str, room_id: str) -> None:
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_text(message)


manager = ConnectionManager()


# --- REST: list/detail for mobile (GET /api/chats, GET /api/chats/{room_id}) ---

@router.get("/chats")
async def list_chats(claims: AuthenticatedUser) -> list[dict]:
    """List chat rooms for the authenticated user. Returns 200 with [] when none."""
    rooms = await list_rooms_for_user(claims.user_id)
    result = []
    for room in rooms:
        last = await get_room_last_message(str(room.id))
        result.append({
            "id": str(room.id),
            "match_id": room.match_id,
            "participants": room.participants,
            "type": room.type,
            "last_message": last.body if last else None,
            "last_message_time": last.created_at.isoformat() if last else None,
            "created_at": room.created_at.isoformat(),
            "updated_at": room.updated_at.isoformat(),
        })
    return result


@router.get("/chats/{room_id}")
async def get_chat(room_id: str, claims: AuthenticatedUser) -> dict:
    """Get one chat room with messages. 404 if not found or user not in room."""
    room = await get_room_for_user(claims.user_id, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat room not found",
        )
    messages = await list_messages_for_room(room_id)
    last = await get_room_last_message(room_id)
    return {
        "id": str(room.id),
        "match_id": room.match_id,
        "participants": room.participants,
        "type": room.type,
        "last_message": last.body if last else None,
        "last_message_time": last.created_at.isoformat() if last else None,
        "created_at": room.created_at.isoformat(),
        "updated_at": room.updated_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "chat_room_id": m.chat_room_id,
                "sender_auth0_id": m.sender_auth0_id,
                "sender_name": m.sender_name,
                "body": m.body,
                "is_system": m.is_system,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


# --- Gemini REST + WebSocket (under /api/chat/...) ---

@router.post("/chat/introduction", response_model=IntroductionResponse)
async def generate_introduction(body: IntroductionRequest) -> IntroductionResponse:
    """Generate a warm introduction for mutual friends based on their profiles."""
    if not body.users or len(body.users) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 users required for introduction",
        )
    try:
        client = GeminiClient()
        users_dict = [
            {"name": u.name, "occupation": u.occupation, "interests": u.interests}
            for u in body.users
        ]
        intro = client.generate_initial_introduction(users_dict)
        return IntroductionResponse(introduction=intro)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate introduction: {str(e)}",
        ) from e


@router.post("/chat/continuation", response_model=ContinuationResponse)
async def get_continuation(body: ContinuationRequest) -> ContinuationResponse:
    """Check if conversation is dry; return intervention or None."""
    if not body.messages:
        return ContinuationResponse(continuation=None)
    try:
        client = GeminiClient()
        messages_dict = [
            {"role": m.role, "name": m.name, "content": m.content}
            for m in body.messages
        ]
        continuation = client.get_chat_continuation(messages_dict)
        return ContinuationResponse(continuation=continuation)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get continuation: {str(e)}",
        ) from e


@router.post("/chat/questions", response_model=QuestionsResponse)
async def generate_questions(body: QuestionsRequest) -> QuestionsResponse:
    """Generate new questions based on conversation context."""
    try:
        client = GeminiClient()
        messages_dict = [
            {"role": m.role, "name": m.name, "content": m.content}
            for m in body.messages
        ]
        questions = client.generate_new_questions(messages_dict)
        return QuestionsResponse(questions=questions)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate questions: {str(e)}",
        ) from e


@router.websocket("/chat/ws/chat/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str) -> None:
    await manager.connect(websocket, room_id)
    try:
        history = await chat_service.get_recent_messages(room_id)
        history_data = []
        for msg in history:
            if hasattr(msg, "model_dump"):
                d = msg.model_dump()
                d["id"] = str(d["id"])
                d["timestamp"] = d["created_at"].isoformat()
                d["sender_id"] = d.get("sender_auth0_id") or "system"
                history_data.append(d)
            else:
                history_data.append(msg)

        await websocket.send_text(json.dumps({"type": "history", "messages": history_data}))

        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            msg_create = MessageCreate(
                room_id=room_id,
                sender_id=message_data["sender_id"],
                sender_name=message_data["sender_name"],
                body=message_data["body"],
            )
            saved_msg = await chat_service.save_message(msg_create)

            broadcast_data = {
                "type": "message",
                "message": {
                    "id": str(saved_msg.id),
                    "room_id": saved_msg.chat_room_id,
                    "sender_id": saved_msg.sender_auth0_id or "system",
                    "sender_name": saved_msg.sender_name,
                    "body": saved_msg.body,
                    "timestamp": saved_msg.created_at.isoformat(),
                    "is_system": saved_msg.is_system,
                },
            }
            await manager.broadcast(json.dumps(broadcast_data), room_id)

            async def gemini_check() -> None:
                history_for_gemini = await chat_service.get_messages_for_gemini(room_id, limit=5)
                if len(history_for_gemini) >= 3:
                    intervention = gemini_client.get_chat_continuation(history_for_gemini)
                    if intervention:
                        gemini_msg = MessageCreate(
                            room_id=room_id,
                            sender_id="gemini-bot",
                            sender_name="Flock Bubbly Guide",
                            body=intervention,
                        )
                        saved_gemini = await chat_service.save_message(gemini_msg)
                        gemini_broadcast = {
                            "type": "message",
                            "message": {
                                "id": str(saved_gemini.id),
                                "room_id": saved_gemini.chat_room_id,
                                "sender_id": saved_gemini.sender_auth0_id or "gemini-bot",
                                "sender_name": saved_gemini.sender_name,
                                "body": saved_gemini.body,
                                "timestamp": saved_gemini.created_at.isoformat(),
                                "is_system": True,
                            },
                        }
                        await manager.broadcast(json.dumps(gemini_broadcast), room_id)

            asyncio.create_task(gemini_check())

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception as e:
        manager.disconnect(websocket, room_id)
        raise
