"""Public, read-only BMKG realtime earthquake endpoints."""

from flask import Blueprint

from extensions import limiter
from services.bmkg_realtime_service import BMKGRealtimeError, BMKGRealtimeService
from utils.api_response import error, success

public_realtime_bp = Blueprint("public_realtime", __name__)


def _feed_response(method_name: str):
    try:
        data = getattr(BMKGRealtimeService(), method_name)()
        return success(data)
    except BMKGRealtimeError:
        # Do not expose upstream response bodies, URLs, or internal cache errors.
        return error(
            message="Data gempa realtime sementara tidak dapat diambil. Silakan coba kembali.",
            code="EXTERNAL_SERVICE_ERROR",
            status_code=503,
        )


@public_realtime_bp.get("/api/realtime/latest")
@limiter.limit("20 per minute")
def get_realtime_latest():
    return _feed_response("get_latest")


@public_realtime_bp.get("/api/realtime/m5")
@limiter.limit("20 per minute")
def get_realtime_m5():
    return _feed_response("get_m5")


@public_realtime_bp.get("/api/realtime/felt")
@limiter.limit("20 per minute")
def get_realtime_felt():
    return _feed_response("get_felt")
