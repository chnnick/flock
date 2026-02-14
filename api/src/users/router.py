from fastapi import APIRouter, HTTPException, status

from src.auth.dependencies import AuthenticatedUser
from src.auth.schemas import TokenClaims
from src.users.schemas import UserCreate, UserResponse, UserUpdate
from src.users.service import create_or_update, get_by_auth0_id, update_me

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(claims: AuthenticatedUser) -> UserResponse:
    """Current user profile (requires Auth0 token)."""
    user = await get_by_auth0_id(claims.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)


@router.post("/me", response_model=UserResponse)
async def create_or_update_me(claims: AuthenticatedUser, body: UserCreate) -> UserResponse:
    """Create or update current user profile (e.g. after onboarding)."""
    user = await create_or_update(claims.user_id, body)
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
async def patch_me(claims: AuthenticatedUser, body: UserUpdate) -> UserResponse:
    """Partially update current user profile."""
    user = await update_me(claims.user_id, body)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)
