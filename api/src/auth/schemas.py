from pydantic import BaseModel

class TokenClaims(BaseModel):
    user_id: str 