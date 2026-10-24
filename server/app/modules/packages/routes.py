from fastapi import APIRouter

from app.middleware.auth import CurrentUser
from app.modules.packages import service as package_service
from app.utils.errors import AppError
from app.utils.responses import success_response
from app.utils.serialize import serialize_row, serialize_rows

router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("")
def get_packages(_user: CurrentUser):
    packages = package_service.get_packages()
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
