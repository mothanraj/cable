import re

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from app.middleware.auth import CurrentUser
from app.modules.billing import service as billing_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/billing", tags=["billing"])

BILLING_MONTH_RE = re.compile(r"^\d{4}-\d{2}-01$")


class GenerateBillingRequest(BaseModel):
    customerId: str
    billingMonth: str


class GenerateBillingBulkRequest(BaseModel):
    customerIds: list[str] = Field(min_length=1, max_length=500)
    billingMonth: str


def _validate_billing_month(value: str | None) -> None:
    if value is not None and not BILLING_MONTH_RE.match(value):
        raise AppError(
            code="INVALID_BILLING_MONTH",
            message="Billing month must use YYYY-MM-01 format.",
            status_code=400,
        )


@router.get("")
def get_billing(
    user: CurrentUser,
    billingMonth: str | None = Query(default=None),
):
    _validate_billing_month(billingMonth)
    billing = billing_service.get_billing(
        user_id=user["id"],
        role=user["role"],
        billing_month=billingMonth,
    )
    return success_response({"billing": serialize_rows(billing)})


@router.get("/{billing_id}")
def get_billing_by_id(user: CurrentUser, billing_id: str):
    billing = billing_service.get_billing_by_id(
        billing_id=billing_id,
        user_id=user["id"],
        role=user["role"],
    )
    if billing is None:
        raise AppError(
            code="BILLING_NOT_FOUND",
            message="Billing record not found.",
            status_code=404,
        )
    return success_response({"billing": serialize_row(billing)})


@router.post("/generate")
def generate_billing(user: CurrentUser, body: GenerateBillingRequest):
    if not BILLING_MONTH_RE.match(body.billingMonth):
        raise AppError(
            code="INVALID_REQUEST",
            message=(
                "Customer ID and billing month are required. "
                "Billing month must use YYYY-MM-01 format."
            ),
            status_code=400,
        )

    try:
        result = billing_service.generate_billing(
            customer_id=body.customerId,
            billing_month=body.billingMonth,
            user_id=user["id"],
            role=user["role"],
        )
    except UniqueViolation as exc:
        raise AppError(
            code="BILLING_ALREADY_EXISTS",
            message=(
                "Billing already exists for this customer and month."
            ),
            status_code=409,
        ) from exc

    if result is None:
        raise AppError(
            code="CUSTOMER_NOT_FOUND",
            message=(
                "Customer not found or you do not have permission."
            ),
            status_code=404,
        )

    return success_response(
        {
            "billing": serialize_row(result["billing"]),
            "previousOverpaid": result["previousOverpaid"],
        },
        status_code=201,
    )


@router.post("/generate-bulk")
def generate_billing_bulk(
    user: CurrentUser,
    body: GenerateBillingBulkRequest,
):
    if not BILLING_MONTH_RE.match(body.billingMonth):
        raise AppError(
            code="INVALID_REQUEST",
            message=(
                "Customer IDs and billing month are required. "
                "Billing month must use YYYY-MM-01 format."
            ),
            status_code=400,
        )

    customer_ids = list(
        dict.fromkeys(
            str(cid).strip() for cid in body.customerIds if str(cid).strip()
        )
    )

    if not customer_ids:
        raise AppError(
            code="INVALID_REQUEST",
            message="Provide at least one customer ID.",
            status_code=400,
        )

    result = billing_service.generate_billing_bulk(
        customer_ids=customer_ids,
        billing_month=body.billingMonth,
        user_id=user["id"],
        role=user["role"],
    )

    return success_response(
        {
            "generated": result["generated"],
            "skipped": result["skipped"],
            "failed": result["failed"],
        }
    )
