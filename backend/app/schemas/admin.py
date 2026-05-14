from pydantic import BaseModel, Field
from typing import Optional


class AdminDeleteUserRequest(BaseModel):
    target_user_id: str = Field(..., description="UUID của user cần xóa")


class AdminDeleteUserResponse(BaseModel):
    success: bool
    message: str
    deleted_user_id: Optional[str] = None
