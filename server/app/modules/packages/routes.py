from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from app.middleware.auth import CurrentUser, require_roles
from app.modules.packages import service as package_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/packages", tags=["packages"])

AdminUser = Annotated[dict, Depends(require_roles("ADMIN"))]


class CreatePackageRequest(BaseModel):
    packageName: str = Field(min_length=1, max_length=100)
    monthlyAmount: float = Field(ge=0)


class UpdatePackageRequest(BaseModel):
    packageName: str = Field(min_length=1, max_length=100)
    monthlyAmount: float = Field(ge=0)


def _clean_package_name(value: str) -> str:
    package_name = value.strip()
    if not package_name:
        raise AppError(
            code="INVALID_REQUEST",
            message="Package name cannot be empty.",
            status_code=400,
        )
    return package_name


@router.get("")
def get_packages(
    user: CurrentUser,
    include_inactive: bool = Query(default=False, alias="includeInactive"),
):
    if include_inactive and user["role"] != "ADMIN":
        raise AppError(
            code="FORBIDDEN",
            message="Only administrators can view inactive packages.",
            status_code=403,
        )

    packages = package_service.get_packages(
        include_inactive=include_inactive
    )
    return success_response({"packages": serialize_rows(packages)})


@router.get("/{package_id}")
def get_package_by_id(_user: CurrentUser, package_id: str):
    package = package_service.get_package_by_id(package_id)
    if package is None:
        raise AppError(
            code="PACKAGE_NOT_FOUND",
            message="Package not found.",
            status_code=404,
        )
    return success_response({"package": serialize_row(package)})


@router.post("")
def create_package(_admin: AdminUser, body: CreatePackageRequest):
    try:
        package = package_service.create_package(
            package_name=_clean_package_name(body.packageName),
            monthly_amount=body.monthlyAmount,
        )
    except UniqueViolation as exc:
        raise AppError(
            code="PACKAGE_EXISTS",
            message="Package already exists.",
            status_code=409,
        ) from exc

    return success_response(
        {"package": serialize_row(package)},
        status_code=201,
    )


@router.patch("/{package_id}")
def update_package(
    _admin: AdminUser,
    package_id: str,
    body: UpdatePackageRequest,
):
    try:
        package = package_service.update_package(
            package_id=package_id,
            package_name=_clean_package_name(body.packageName),
            monthly_amount=body.monthlyAmount,
        )
    except UniqueViolation as exc:
        raise AppError(
            code="PACKAGE_EXISTS",
            message="Package already exists.",
            status_code=409,
        ) from exc

    if package is None:
        raise AppError(
            code="PACKAGE_NOT_FOUND",
            message="Package not found.",
            status_code=404,
        )

    return success_response({"package": serialize_row(package)})


@router.patch("/{package_id}/default")
def set_default_package(_admin: AdminUser, package_id: str):
    package = package_service.set_default_package(package_id)
    if package is None:
        raise AppError(
            code="PACKAGE_NOT_FOUND",
            message="Package not found or is inactive.",
            status_code=404,
        )
    return success_response({"package": serialize_row(package)})


@router.patch("/{package_id}/activate")
def activate_package(_admin: AdminUser, package_id: str):
    package = package_service.set_package_status(
        package_id=package_id,
        is_active=True,
    )
    if package is None:
        raise AppError(
            code="PACKAGE_NOT_FOUND",
            message="Package not found.",
            status_code=404,
        )
    return success_response({"package": serialize_row(package)})


@router.patch("/{package_id}/deactivate")
def deactivate_package(_admin: AdminUser, package_id: str):
    if package_service.get_default_package_id() == package_id:
        raise AppError(
            code="DEFAULT_PACKAGE_IN_USE",
            message=(
                "Choose another default package before deactivating "
                "this one."
            ),
            status_code=400,
        )

    package = package_service.set_package_status(
        package_id=package_id,
        is_active=False,
    )
    if package is None:
        raise AppError(
            code="PACKAGE_NOT_FOUND",
            message="Package not found.",
            status_code=404,
        )
    return success_response({"package": serialize_row(package)})
