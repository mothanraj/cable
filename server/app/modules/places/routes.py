from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from app.middleware.auth import CurrentUser, require_roles
from app.modules.places import service as place_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/places", tags=["places"])

AdminUser = Annotated[dict, Depends(require_roles("ADMIN"))]


class CreatePlaceRequest(BaseModel):
    placeName: str = Field(min_length=1, max_length=150)


class UpdatePlaceRequest(BaseModel):
    placeName: str = Field(min_length=1, max_length=150)


@router.get("")
def get_places(
    user: CurrentUser,
    include_inactive: bool = Query(default=False, alias="includeInactive"),
):
    if include_inactive and user["role"] != "ADMIN":
        raise AppError(
            code="FORBIDDEN",
            message="Only administrators can view inactive places.",
            status_code=403,
        )

    places = place_service.get_places(include_inactive=include_inactive)
    return success_response({"places": serialize_rows(places)})


def _clean_place_name(value: str) -> str:
    place_name = value.strip()
    if not place_name:
        raise AppError(
            code="INVALID_REQUEST",
            message="Place name cannot be empty.",
            status_code=400,
        )
    return place_name


@router.post("")
def create_place(_admin: AdminUser, body: CreatePlaceRequest):
    try:
        place = place_service.create_place(
            _clean_place_name(body.placeName)
        )
    except UniqueViolation as exc:
        raise AppError(
            code="PLACE_EXISTS",
            message="Place already exists.",
            status_code=409,
        ) from exc

    return success_response(
        {"place": serialize_row(place)},
        status_code=201,
    )


@router.patch("/{place_id}")
def update_place(
    _admin: AdminUser,
    place_id: str,
    body: UpdatePlaceRequest,
):
    try:
        place = place_service.update_place(
            place_id=place_id,
            place_name=_clean_place_name(body.placeName),
        )
    except UniqueViolation as exc:
        raise AppError(
            code="PLACE_EXISTS",
            message="Place already exists.",
            status_code=409,
        ) from exc

    if place is None:
        raise AppError(
            code="PLACE_NOT_FOUND",
            message="Place not found.",
            status_code=404,
        )

    return success_response({"place": serialize_row(place)})


@router.patch("/{place_id}/activate")
def activate_place(_admin: AdminUser, place_id: str):
    place = place_service.set_place_status(
        place_id=place_id,
        is_active=True,
    )
    if place is None:
        raise AppError(
            code="PLACE_NOT_FOUND",
            message="Place not found.",
            status_code=404,
        )
    return success_response({"place": serialize_row(place)})


@router.patch("/{place_id}/deactivate")
def deactivate_place(_admin: AdminUser, place_id: str):
    place = place_service.set_place_status(
        place_id=place_id,
        is_active=False,
    )
    if place is None:
        raise AppError(
            code="PLACE_NOT_FOUND",
            message="Place not found.",
            status_code=404,
        )
    return success_response({"place": serialize_row(place)})
