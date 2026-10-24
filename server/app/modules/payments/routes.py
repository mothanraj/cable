import re

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.middleware.auth import CurrentUser
from app.modules.payments import service as payment_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/payments", tags=["payments"])

PAYMENT_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class CreatePaymentRequest(BaseModel):
    billingId: str
    paymentDate: str
    collectedAmount: float = Field(gt=0)
    remarks: str | None = None


@router.get("")
def get_payments(
    user: CurrentUser,
    billingId: str | None = Query(default=None),
):
    payments = payment_service.get_payments(
        user_id=user["id"],
        role=user["role"],
        billing_id=billingId,
    )
    return success_response({"payments": serialize_rows(payments)})


@router.get("/{payment_id}")
def get_payment_by_id(user: CurrentUser, payment_id: str):
    payment = payment_service.get_payment_by_id(
        payment_id=payment_id,
        user_id=user["id"],
        role=user["role"],
    )
    if payment is None:
        raise AppError(
            code="PAYMENT_NOT_FOUND",
            message="Payment record not found.",
            status_code=404,
        )
    return success_response({"payment": serialize_row(payment)})


@router.post("")
def create_payment(user: CurrentUser, body: CreatePaymentRequest):
    if not PAYMENT_DATE_RE.match(body.paymentDate):
        raise AppError(
            code="INVALID_REQUEST",
            message=(
                "Billing ID, valid payment date, and a positive "
                "collected amount are required."
            ),
            status_code=400,
        )

    payment = payment_service.create_payment(
        billing_id=body.billingId,
        payment_date=body.paymentDate,
        collected_amount=body.collectedAmount,
        remarks=body.remarks,
        user_id=user["id"],
        role=user["role"],
    )

    if payment is None:
        raise AppError(
            code="BILLING_NOT_FOUND",
            message=(
                "Billing record not found or you do not have permission."
            ),
            status_code=404,
        )

    return success_response(
        {"payment": serialize_row(payment)},
        status_code=201,
    )
