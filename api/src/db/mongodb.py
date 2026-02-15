import pymongo  
from pymongo import AsyncMongoClient  
from beanie import init_beanie  
from src.config import settings
from src.db.models.user import User
async def init_db():
    client = AsyncMongoClient(
        settings.MONGO_URI,
        server_api=pymongo.server_api.ServerApi(version="1")
    )
    db = client.get_database("commutebuddy")

    await init_beanie(
        database=db,
        document_models=[User, ChatMessage, ChatRoom]
    )