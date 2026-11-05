import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.middleware.auth import require_roles
from app.modules.reports import service as report_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_value

router = APIRouter(prefix="/reports", tags=["reports"])

AdminUser = Annotated[dict, Depends(require_roles("ADMIN"))]

BILLING_MONTH_RE = re.compile(r"^\d{4}-\d{2}-01$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_date(value: str | None, field_name: str) -> date | None:
    if value is None:
        return None

    if not DATE_RE.match(value):
        raise AppError(
            code=f"INVALID_{field_name.upper()}_DATE",
            message=f"{field_name.capitalize()} date must use YYYY-MM-DD format.",
            status_code=400,
        )

    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise AppError(
            code=f"INVALID_{field_name.upper()}_DATE",
            message=f"{field_name.capitalize()} date must be a valid date.",
            status_code=400,
        ) from exc


@router.get("/billing")
def get_billing_report(
    user: AdminUser,
    billingMonth: str | None = Query(default=None),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
):
    if billingMonth is not None and not BILLING_MONTH_RE.match(billingMonth):
        raise AppError(
            code="INVALID_BILLING_MONTH",
            message="Billing month must use YYYY-MM-01 format.",
            status_code=400,
        )

    parsed_from = _validate_date(from_date, "from")
    parsed_to = _validate_date(to_date, "to")

    if (parsed_from is None) != (parsed_to is None):
        raise AppError(
            code="INCOMPLETE_DATE_RANGE",
            message="Both from and to dates are required.",
            status_code=400,
        )

    if parsed_from is not None and billingMonth is not None:
        raise AppError(
            code="CONFLICTING_FILTERS",
            message="Use either billingMonth or a from/to date range, not both.",
            status_code=400,
        )

    if (
        parsed_from is not None
        and parsed_to is not None
        and parsed_from > parsed_to
    ):
        raise AppError(
            code="INVALID_DATE_RANGE",
            message="From date must be on or before to date.",
            status_code=400,
        )

    report = report_service.get_billing_report(
        user_id=user["id"],
        role=user["role"],
        billing_month=billingMonth,
        from_date=from_date,
        to_date=to_date,
    )

    return success_response({"billing": serialize_value(report)})
