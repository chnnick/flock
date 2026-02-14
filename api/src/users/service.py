from src.db.models.user import User
from src.users.schemas import UserCreateDTO, UserResponseDTO

async def create_user(auth0_id: str, body: UserCreateDTO) -> User:
    existing = await User.find_one(User.auth0_id == auth0_id)
    if existing:
        return None
    user = User(
        auth0_id=auth0_id,
        name=body.name,
        occupation=body.occupation,
        gender=body.gender,
        interests=body.interests,
    )
    await user.insert()
    return user

async def get_user_by_auth0_id(auth0_id: str) -> User | None:
    return await User.find_one(User.auth0_id == auth0_id)

async def delete_user(auth0_id: str) -> bool:
    user = await User.find_one(User.auth0_id == auth0_id)
    if not user:
        return False
    await user.delete()
    return True