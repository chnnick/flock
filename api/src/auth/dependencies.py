# https://auth0.com/docs/quickstart/backend/fastapi
from fastapi import Depends
from fastapi_plugin.fast_api_client import Auth0FastAPI
from src.config import settings
from src.auth.schemas import TokenClaims
from typing import Annotated

auth0 = Auth0FastAPI(
    domain=settings.AUTH0_DOMAIN,
    audience=settings.AUTH0_AUDIENCE,
)

# only runs if require_auth() is successful
async def get_token_claims(
    claims: dict = Depends(auth0.require_auth()),
) -> TokenClaims:
    return TokenClaims(user_id=claims["sub"])

# to use in endpoints: from src.auth.dependencies import AuthenticatedUser
AuthenticatedUser = Annotated[TokenClaims, Depends(get_token_claims)]