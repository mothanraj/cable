from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from app.middleware.auth import CurrentUser
from app.modules.customers import service as customer_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/customers", tags=["customers"])


class CreateCustomerRequest(BaseModel):
    customerName: str = Field(min_length=1)
    stbNumber: str = Field(min_length=1)
    phone: str | None = None
    place: str | None = None
    packageId: str
    customMonthlyAmount: float | None = None
    assignedUserId: str | None = None
    remarks: str | None = None


class UpdateCustomerRequest(BaseModel):
    customerName: str = Field(min_length=1)
    stbNumber: str = Field(min_length=1)
    phone: str | None = None
    place: str | None = None
    packageId: str
    customMonthlyAmount: float | None = None
    remarks: str | None = None


class UpdateOrderRequest(BaseModel):
    displayOrder: int = Field(ge=0)


class AssignCustomerRequest(BaseModel):
    assignedUserId: str


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


@router.get("")
def get_customers(
    user: CurrentUser,
    search: str | None = Query(default=None),
):
    customers = customer_service.get_customers(
        user_id=user["id"],
        role=user["role"],
        search=search,
    )
    return success_response({"customers": serialize_rows(customers)})


@router.get("/{customer_id}")
def get_customer_by_id(user: CurrentUser, customer_id: str):
    customer = customer_service.get_customer_by_id(
        customer_id=customer_id,
        user_id=user["id"],
        role=user["role"],
    )
    if customer is None:
        raise AppError(
            code="CUSTOMER_NOT_FOUND",
            message="Customer not found.",
            status_code=404,
        )
    return success_response({"customer": serialize_row(customer)})


@router.post("")
def create_customer(user: CurrentUser, body: CreateCustomerRequest):
    assigned_user_id = (
        body.assignedUserId
        if user["role"] == "ADMIN"
        else user["id"]
    )

    if not assigned_user_id:
        raise AppError(
            code="ASSIGNED_USER_REQUIRED",
            message="Assigned user is required.",
            status_code=400,
        )

    if (
        body.customMonthlyAmount is not None
        and body.customMonthlyAmount < 0
    ):
        raise AppError(
            code="INVALID_REQUEST",
            message="Custom monthly amount cannot be negative.",
            status_code=400,
        )

    try:
        customer = customer_service.create_customer(
            {
                "customer_name": body.customerName.strip(),
                "stb_number": body.stbNumber.strip(),
                "phone": _optional_text(body.phone),
                "place": _optional_text(body.place),
                "package_id": body.packageId,
                "custom_monthly_amount": body.customMonthlyAmount,
                "assigned_user_id": assigned_user_id,
                "remarks": _optional_text(body.remarks),
            }
        )
    except UniqueViolation as exc:
        raise AppError(
            code="STB_NUMBER_EXISTS",
            message="STB number already exists.",
            status_code=409,
        ) from exc
    except ForeignKeyViolation as exc:
        raise AppError(
            code="INVALID_REFERENCE",
            message="Package or assigned user does not exist.",
            status_code=400,
        ) from exc

    return success_response(
        {"customer": serialize_row(customer)},
        status_code=201,
    )


@router.patch("/{customer_id}")
def update_customer(
    user: CurrentUser,
    customer_id: str,
    body: UpdateCustomerRequest,
):
    if (
        body.customMonthlyAmount is not None
        and body.customMonthlyAmount < 0
    ):
        raise AppError(
            code="INVALID_REQUEST",
            message="Custom monthly amount cannot be negative.",
            status_code=400,
        )

    try:
        customer = customer_service.update_customer(
            customer_id=customer_id,
            user_id=user["id"],
            role=user["role"],
            payload={
                "customer_name": body.customerName.strip(),
                "stb_number": body.stbNumber.strip(),
                "phone": _optional_text(body.phone),
                "place": _optional_text(body.place),
                "package_id": body.packageId,
                "custom_monthly_amount": body.customMonthlyAmount,
                "remarks": _optional_text(body.remarks),
            },
        )
    except UniqueViolation as exc:
        raise AppError(
            code="STB_NUMBER_EXISTS",
            message="STB number already exists.",
            status_code=409,
        ) from exc

    if customer is None:
        raise AppError(
            code="CUSTOMER_NOT_FOUND",
            message=(
                "Customer not found or you do not have permission to edit it."
            ),
            status_code=404,
        )

    return success_response({"customer": serialize_row(customer)})


@router.patch("/{customer_id}/order")
def update_customer_order(
    user: CurrentUser,
    customer_id: str,
    body: UpdateOrderRequest,
):
    customer = customer_service.update_customer_order(
        customer_id=customer_id,
        user_id=user["id"],
        role=user["role"],
        display_order=body.displayOrder,
    )
    if customer is None:
        raise AppError(
            code="CUSTOMER_NOT_FOUND",
            message=(
                "Customer not found or you do not have permission."
            ),
            status_code=404,
        )
    return success_response({"customer": serialize_row(customer)})


@router.patch("/{customer_id}/deactivate")
def deactivate_customer(user: CurrentUser, customer_id: str):
    customer = customer_service.set_customer_status(
        customer_id=customer_id,
        user_id=user["id"],
        role=user["role"],
        is_active=False,
    )
    if customer is None:
        raise AppError(
            code="CUSTOMER_NOT_FOUND",
            message=(
                "Customer not found or you do not have permission."
            ),
            status_code=404,
        )
    return success_response({"customer": serialize_row(customer)})


@router.patch("/{customer_id}/assign")
def assign_customer(
    user: CurrentUser,
    customer_id: str,
    body: AssignCustomerRequest,
):
    if user["role"] != "ADMIN":
        raise AppError(
            code="FORBIDDEN",
            message="Only administrators can reassign customers.",
            status_code=403,
        )

    customer = customer_service.assign_customer(
        customer_id=customer_id,
        assigned_user_id=body.assignedUserId,
    )
    if customer is None:
        raise AppError(
            code="CUSTOMER_NOT_FOUND",
            message="Customer not found.",
            status_code=404,
        )
    return success_response({"customer": serialize_row(customer)})
