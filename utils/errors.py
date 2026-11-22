"""Centralized API exception handling."""
from __future__ import annotations

from flask import Flask, current_app
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from utils.api_response import error


_HTTP_ERROR_CODES = {
    400: "BAD_REQUEST",
    401: "AUTH_REQUIRED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "FILE_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    429: "RATE_LIMITED",
}


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        status = exc.code or 500
        code = _HTTP_ERROR_CODES.get(status, "HTTP_ERROR")
        return error(
            message=exc.description if status < 500 else "Terjadi kesalahan pada server.",
            code=code,
            status_code=status,
        )

    @app.errorhandler(SQLAlchemyError)
    def handle_database_exception(exc: SQLAlchemyError):
        current_app.logger.exception("database_error")
        return error(
            message="Terjadi kesalahan saat mengakses database.",
            code="DATABASE_ERROR",
            status_code=500,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(exc: Exception):
        current_app.logger.exception("unhandled_exception")
        return error(
            message="Terjadi kesalahan internal pada server.",
            code="INTERNAL_SERVER_ERROR",
            status_code=500,
        )
