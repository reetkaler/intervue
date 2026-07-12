from fastapi import Header, HTTPException
from gotrue.errors import AuthError

from app.services.supabase_client import admin_client


def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ")
    try:
        response = admin_client.auth.get_user(token)
    except AuthError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if response is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return response.user.id
