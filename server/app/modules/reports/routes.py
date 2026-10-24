import re

from fastapi import APIRouter, Query

from app.middleware.auth import CurrentUser
from app.modules.reports import service as report_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_value

router = APIRouter(prefix="/reports", tags=["reports"])

BILLING_MONTH_RE = re.compile(r"^\d{4}-\d{2}-01$")


@router.get("/billing")
def get_billing_report(
    user: CurrentUser,
    billingMonth: str | None = Query(default=None),
):
    if billingMonth is not None and not BILLING_MONTH_RE.match(billingMonth):
        raise AppError(
            code="INVALID_BILLING_MONTH",
            message="Billing month must use YYYY-MM-01 format.",
            status_code=400,
        )

    report = report_service.get_billing_report(
        user_id=user["id"],
        role=user["role"],
        billing_month=billingMonth,
    )

    return success_response({"billing": serialize_value(report)})
