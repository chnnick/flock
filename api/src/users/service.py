from src.db.models.user import User
from src.users.schemas import UserCreate, UserUpdate


async def get_by_auth0_id(auth0_id: str) -> User | None:
    return await User.find_one(User.auth0_id == auth0_id)


async def create_or_update(auth0_id: str, payload: UserCreate) -> User:
    existing = await get_by_auth0_id(auth0_id)
    if existing:
        existing.name = payload.name
        existing.occupation = payload.occupation
        existing.gender = payload.gender
        existing.interests = payload.interests
        await existing.save()
        return existing
    user = User(
        auth0_id=auth0_id,
        name=payload.name,
        occupation=payload.occupation,
        gender=payload.gender,
        interests=payload.interests,
    )
    await user.insert()
    return user


async def update_me(auth0_id: str, payload: UserUpdate) -> User | None:
    user = await get_by_auth0_id(auth0_id)
    if not user:
        return None
    if payload.name is not None:
        user.name = payload.name
    if payload.occupation is not None:
        user.occupation = payload.occupation
    if payload.gender is not None:
        user.gender = payload.gender
    if payload.interests is not None:
        user.interests = payload.interests
    await user.save()
    return user
