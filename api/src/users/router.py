from fastapi import APIRouter, HTTPException, status 

from src.auth.dependencies import AuthenticatedUser
from src.users.schemas import UserCreateDTO, UserResponseDTO
from src.users.service import create_user, get_user_by_auth0_id, delete_user
from src.db.models.user import User

router = APIRouter(prefix="/users", tags=["users"])

def _to_response(user: User) -> UserResponseDTO:
    return UserResponseDTO(
        id=str(user.id),
        auth0_id=user.auth0_id,
        name=user.name,
        occupation=user.occupation,
        gender=user.gender,
        interests=user.interests,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )

@router.post("", response_model=UserResponseDTO, status_code=status.HTTP_201_CREATED)
async def signup(body: UserCreateDTO, claims: AuthenticatedUser):
    user = await create_user(claims.user_id, body)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User profile already exists for this account",
        )
    return _to_response(user)

@router.get("/me", response_model=UserResponseDTO)
async def get_me(claims: AuthenticatedUser):
    user = await get_user_by_auth0_id(claims.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )
    return _to_response(user)

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(claims: AuthenticatedUser):
    deleted = await delete_user(claims.user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )