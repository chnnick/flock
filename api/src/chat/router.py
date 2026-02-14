from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict
import json
import asyncio
from src.chat.service import chat_service
from src.chat.schemas import MessageCreate, MessageRead
from src.gemini.gemini import GeminiClient

router = APIRouter()
gemini_client = GeminiClient()

class ConnectionManager:
    def __init__(self):
        # room_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: str, room_id: str):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_text(message)

manager = ConnectionManager()

@router.websocket("/ws/chat/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    print(f"Incoming WebSocket connection request for room: {room_id}")
    await manager.connect(websocket, room_id)
    print(f"WebSocket connected for room: {room_id}")
    try:
        # Send recent history to the newly connected client
        history = await chat_service.get_recent_messages(room_id)
        # We need to serialize history properly if it contains Beanie objects
        history_data = []
        for msg in history:
            if hasattr(msg, "dict"):
                # It's a Beanie object
                d = msg.dict()
                d["id"] = str(d["id"])
                d["timestamp"] = d["timestamp"].isoformat()
                history_data.append(d)
            else:
                # It's already a dict from Redis
                history_data.append(msg)
        
        await websocket.send_text(json.dumps({"type": "history", "messages": history_data}))

        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Expecting message_data to have sender_id, sender_name, body
            msg_create = MessageCreate(
                room_id=room_id,
                sender_id=message_data["sender_id"],
                sender_name=message_data["sender_name"],
                body=message_data["body"]
            )
            
            # Save message
            saved_msg = await chat_service.save_message(msg_create)
            
            # Broadcast to all in room
            broadcast_data = {
                "type": "message",
                "message": {
                    "id": str(saved_msg.id),
                    "room_id": saved_msg.room_id,
                    "sender_id": saved_msg.sender_id,
                    "sender_name": saved_msg.sender_name,
                    "body": saved_msg.body,
                    "timestamp": saved_msg.timestamp.isoformat(),
                    "is_system": saved_msg.is_system
                }
            }
            await manager.broadcast(json.dumps(broadcast_data), room_id)

            # --- Gemini Integration ---
            # Check if we should intervene (e.g., if conversation is dry)
            # We don't want to block the main loop, so we could do this in background
            async def gemini_check():
                history_for_gemini = await chat_service.get_messages_for_gemini(room_id, limit=5)
                if len(history_for_gemini) >= 3: # Only check if at least 3 messages
                    intervention = gemini_client.get_chat_continuation(history_for_gemini)
                    if intervention:
                        # Save Gemini's message
                        gemini_msg = MessageCreate(
                            room_id=room_id,
                            sender_id="gemini-bot",
                            sender_name="Flock Bubbly Guide",
                            body=intervention
                        )
                        saved_gemini = await chat_service.save_message(gemini_msg)
                        
                        # Broadcast Gemini's message
                        gemini_broadcast = {
                            "type": "message",
                            "message": {
                                "id": str(saved_gemini.id),
                                "room_id": saved_gemini.room_id,
                                "sender_id": saved_gemini.sender_id,
                                "sender_name": saved_gemini.sender_name,
                                "body": saved_gemini.body,
                                "timestamp": saved_gemini.timestamp.isoformat(),
                                "is_system": True
                            }
                        }
                        await manager.broadcast(json.dumps(gemini_broadcast), room_id)

            asyncio.create_task(gemini_check())
            
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for room: {room_id}")
        manager.disconnect(websocket, room_id)
    except Exception as e:
        print(f"Error in websocket for room {room_id}: {e}")
        manager.disconnect(websocket, room_id)
