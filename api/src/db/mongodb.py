from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import certifi
from src.config import settings
from src.db.models.user import User
from src.db.models.chat import ChatMessage, ChatRoom

async def init_db():
    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        tlsCAFile=certifi.where()  # Uses system CA certificates
    )
    db = client.get_database("commutebuddy")

    await init_beanie(
        database=db,
        document_models=[User, ChatMessage, ChatRoom]
    )