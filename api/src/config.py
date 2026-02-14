from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = API_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(API_DIR / ".env", REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
    )

    AUTH0_DOMAIN: str
    AUTH0_AUDIENCE: str
    MONGO_URI: str
    GEMINI_API_KEY: str

settings = Settings()