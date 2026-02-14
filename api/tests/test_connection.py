from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from src.config import settings

def main():
    client = MongoClient(settings.MONGO_URI, server_api=ServerApi('1'))
    try:
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    main()