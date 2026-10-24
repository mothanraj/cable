from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID


def serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return serialize_row(value)
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    return value


def serialize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: serialize_value(value) for key, value in row.items()}


def serialize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [serialize_row(row) for row in rows]
