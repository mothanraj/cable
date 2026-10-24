from typing import Any

from fastapi.responses import JSONResponse


def success_response(
    data: Any = None,
    *,
    status_code: int = 200,
    message: str | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {"success": True}
    if message is not None:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return JSONResponse(content=body, status_code=status_code)


def error_response(
    *,
    code: str,
    message: str,
    status_code: int,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
            },
        },
    )
