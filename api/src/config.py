from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
    )

    AUTH0_DOMAIN: str
    AUTH0_AUDIENCE: str
    MONGO_URI: str
    GEMINI_API_KEY: str
    REDIS_HOST: str = 'localhost'
    REDIS_PORT: int = 6379
    REDIS_USERNAME: str = 'default'
    REDIS_PASSWORD: str = ''

settings = Settings()