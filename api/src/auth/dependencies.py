# https://auth0.com/docs/quickstart/backend/fastapi
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from fastapi_plugin.fast_api_client import Auth0FastAPI

from src.auth.schemas import TokenClaims
from src.config import settings

if settings.DEV_AUTH_BYPASS:
    async def get_token_claims(
        x_dev_auth0_id: Annotated[str | None, Header(alias="x-dev-auth0-id")] = None,
    ) -> TokenClaims:
        return TokenClaims(user_id=x_dev_auth0_id or settings.DEV_AUTH_DEFAULT_USER_ID)
else:
    if not settings.AUTH0_DOMAIN or not settings.AUTH0_AUDIENCE:
        raise RuntimeError("AUTH0_DOMAIN and AUTH0_AUDIENCE are required when DEV_AUTH_BYPASS is false")

    auth0 = Auth0FastAPI(
        domain=settings.AUTH0_DOMAIN,
        audience=settings.AUTH0_AUDIENCE,
    )

    async def get_token_claims(
        claims: dict = Depends(auth0.require_auth()),
    ) -> TokenClaims:
        sub = claims.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid auth claims")
        return TokenClaims(user_id=sub)


# to use in endpoints: from src.auth.dependencies import AuthenticatedUser
AuthenticatedUser = Annotated[TokenClaims, Depends(get_token_claims)]