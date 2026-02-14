import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db.mongodb import init_db
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
    allow_origins=["*"],  # Restrict in production (e.g. EXPO_PUBLIC_DOMAIN origins)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(users_router, prefix="/api", tags=["users"])


@app.get("/api/health")
def health():
    """No auth. Use this to confirm the API is up."""
    return {"status": "ok"}


# Endpoints: GET/POST/PATCH /api/users/me require Authorization: Bearer <Auth0 access token>.
# 400 on POST /api/users/me usually means missing or invalid token — add the header and retry.
