from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db.mongodb import init_db
from src.users.router import router as users_router
from src.chat.router import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    # shutdown: close DB connections if needed


app = FastAPI(title="Flock API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production (e.g. EXPO_PUBLIC_DOMAIN origins)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(users_router, prefix="/api", tags=["users"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
