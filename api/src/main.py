import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.chat.router import router as chats_router
from src.db.mongodb import init_db
from src.commutes.router import router as commutes_router
from src.matching.router import router as matching_router
from src.users.router import router as users_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
        logger.info("MongoDB connected")
    except Exception as e:
        logger.warning("MongoDB init failed (app will start; /api/users/* will fail): %s", e)
        # Python 3.13 + Atlas often has SSL handshake errors; use Python 3.11 or 3.12 for the API venv
    yield
    # shutdown: close DB connections if needed


app = FastAPI(title="Flock API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Wildcard origins do not work with credentials in browsers.
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "x-dev-auth0-id"],
)

app.include_router(users_router, prefix="/api", tags=["users"])
app.include_router(commutes_router, prefix="/api", tags=["commutes"])
app.include_router(matching_router, prefix="/api", tags=["matching"])
app.include_router(chats_router, prefix="/api", tags=["chats"])


@app.get("/api/health")
def health():
    """No auth. Use this to confirm the API is up."""
    return {"status": "ok"}


# Endpoints: GET/POST/PATCH /api/users/me require Authorization: Bearer <Auth0 access token>.
# 400 on POST /api/users/me usually means missing or invalid token — add the header and retry.
