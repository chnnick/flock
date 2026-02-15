from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = API_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(API_DIR / ".env", REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    AUTH0_DOMAIN: str | None = None
    AUTH0_AUDIENCE: str | None = None
    AUTH0_MGMT_CLIENT_ID: str | None = None
    AUTH0_MGMT_CLIENT_SECRET: str | None = None
    MONGO_URI: str
    GEMINI_API_KEY: str
    DEV_AUTH_BYPASS: bool = False
    DEV_AUTH_DEFAULT_USER_ID: str = "auth0|demo_you"
    OTP_BASE_URL: str | None = None
    OTP_GRAPHQL_PATH: str = "/otp/routers/default/index/graphql"
    OTP_TIMEOUT_SECONDS: float = 15.0

settings = Settings()