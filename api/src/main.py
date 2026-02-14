import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    allow_origins=["*"],  # Restrict in production (e.g. EXPO_PUBLIC_DOMAIN origins)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(users_router, prefix="/api", tags=["users"])
app.include_router(commutes_router, prefix="/api", tags=["commutes"])
app.include_router(matching_router, prefix="/api", tags=["matching"])


@app.get("/api/health")
def health():
    """No auth. Use this to confirm the API is up."""
    return {"status": "ok"}


# TODO: Add endpoints (all under /api):
# Currently:
#   GET  /api/health      — health check (no auth)
#   GET  /api/users/me    — current user (Auth0 required)
#   POST /api/users/me    — create/update profile (Auth0, body: name, occupation, gender, interests)
#   PATCH /api/users/me   — partial update (Auth0)
