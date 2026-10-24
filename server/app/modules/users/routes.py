from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from app.middleware.auth import require_roles
from app.modules.users import service as user_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/users", tags=["users"])

AdminUser = Annotated[dict, Depends(require_roles("ADMIN"))]


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1)
    fullName: str = Field(min_length=1)
    password: str = Field(min_length=12)


@router.get("")
def get_users(_admin: AdminUser):
    users = user_service.get_users()
    return success_response({"users": serialize_rows(users)})


@router.post("")
def create_user(_admin: AdminUser, body: CreateUserRequest):
    try:
        user = user_service.create_user(
            username=body.username.strip(),
            full_name=body.fullName.strip(),
            password=body.password,
        )
    except UniqueViolation as exc:
        raise AppError(
            code="USERNAME_EXISTS",
            message="Username already exists.",
            status_code=409,
        ) from exc

    return success_response(
        {"user": serialize_row(user)},
        status_code=201,
    )


@router.patch("/{user_id}/activate")
def activate_user(_admin: AdminUser, user_id: str):
    user = user_service.set_user_status(user_id, True)
    if user is None:
        raise AppError(
            code="USER_NOT_FOUND",
            message="User not found.",
            status_code=404,
        )
    return success_response({"user": serialize_row(user)})


@router.patch("/{user_id}/deactivate")
def deactivate_user(_admin: AdminUser, user_id: str):
    user = user_service.set_user_status(user_id, False)
    if user is None:
        raise AppError(
            code="USER_NOT_FOUND",
            message="User not found.",
            status_code=404,
        )
    return success_response({"user": serialize_row(user)})
