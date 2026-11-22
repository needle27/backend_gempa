"""Translate expected service exceptions into the documented API envelope."""

from services.exceptions import ConflictError, NotFoundError, ServiceError, ValidationError
from utils.api_response import error


def service_error_response(exc):
    if isinstance(exc, ValidationError):
        return error(message=str(exc), code="VALIDATION_ERROR", status_code=422)
    if isinstance(exc, ConflictError):
        return error(message=str(exc), code="CONFLICT", status_code=409)
    if isinstance(exc, NotFoundError):
        return error(message=str(exc), code="NOT_FOUND", status_code=404)
    if isinstance(exc, ServiceError):
        return error(message=str(exc), code="PROCESSING_ERROR", status_code=422)
    return error(
        message="Terjadi kesalahan saat memproses permintaan.",
        code="PROCESSING_ERROR",
        status_code=500,
    )
