"""Consistent API response helpers."""
from flask import jsonify


def success(data=None, *, status_code: int = 200, meta: dict | None = None):
    response_meta = {"status": "success"}
    if meta:
        response_meta.update(meta)
    return jsonify({"data": data, "meta": response_meta}), status_code


def list_success(data: list, *, count: int, limit: int, offset: int, status_code: int = 200):
    return success(
        data,
        status_code=status_code,
        meta={"count": count, "limit": limit, "offset": offset},
    )


def error(
    *,
    message: str,
    code: str,
    details: dict | list | None = None,
    status_code: int = 400,
):
    return (
        jsonify(
            {
                "data": None,
                "meta": {
                    "status": "error",
                    "code": code,
                    "message": message,
                    "details": details or {},
                },
            }
        ),
        status_code,
    )
