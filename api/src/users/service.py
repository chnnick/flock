from src.db.models.user import User
from src.db.models.commute import Commute
from src.db.models.match_suggestion import MatchSuggestion
from src.db.models.chat_room import ChatRoom
from src.db.models.chat_message import ChatMessage
from src.users.schemas import UserCreate, UserUpdate
from auth0.management import Auth0 as Auth0Mgmt
from auth0.authentication import GetToken
from src.config import settings


async def _delete_user_data(auth0_id: str) -> None:
    """Remove user from matches, chats, and delete their commute(s)."""
    await Commute.find(Commute.user_auth0_id == auth0_id).delete()
    await MatchSuggestion.find(MatchSuggestion.participants == auth0_id).delete()
    rooms = await ChatRoom.find(ChatRoom.participants == auth0_id).to_list()
    for room in rooms:
        room.participants = [p for p in room.participants if p != auth0_id]
        if not room.participants:
            await ChatMessage.find(ChatMessage.chat_room_id == str(room.id)).delete()
            await room.delete()
        else:
            await room.save()


def _get_auth0_mgmt() -> Auth0Mgmt:
    token = GetToken(
        settings.AUTH0_DOMAIN,
        settings.AUTH0_MGMT_CLIENT_ID,
        client_secret=settings.AUTH0_MGMT_CLIENT_SECRET,
    )
    mgmt_token = token.client_credentials(
        f"https://{settings.AUTH0_DOMAIN}/api/v2/"
    )
    return Auth0Mgmt(settings.AUTH0_DOMAIN, mgmt_token["access_token"])

async def delete_by_auth0_id(auth0_id: str) -> User | None:
    user = await get_by_auth0_id(auth0_id)
    if not user:
        return None

    await _delete_user_data(auth0_id)
    await user.delete()
    try:
        mgmt = _get_auth0_mgmt()
        mgmt.users.delete(auth0_id)
    except Exception:
        pass
    return user

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
