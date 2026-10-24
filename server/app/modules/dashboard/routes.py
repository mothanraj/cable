import re

from fastapi import APIRouter, Query

from app.middleware.auth import CurrentUser
from app.modules.dashboard import service as dashboard_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_value

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

BILLING_MONTH_RE = re.compile(r"^\d{4}-\d{2}-01$")


@router.get("")
def get_dashboard(
    user: CurrentUser,
    billingMonth: str | None = Query(default=None),
):
    if billingMonth is not None and not BILLING_MONTH_RE.match(billingMonth):
        raise AppError(
            code="INVALID_BILLING_MONTH",
            message="Billing month must use YYYY-MM-01 format.",
            status_code=400,
        )

    dashboard = dashboard_service.get_dashboard(
        user_id=user["id"],
        role=user["role"],
        billing_month=billingMonth,
    )

    return success_response(serialize_value(dashboard))
