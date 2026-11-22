"""Liveness and readiness endpoints."""
from flask import Blueprint, current_app
from sqlalchemy import text
from redis.exceptions import RedisError

from extensions import db
from utils.api_response import success, error

health_bp = Blueprint("health", __name__)


@health_bp.get("/api/health")
def liveness():
    """Confirm that the Flask process is alive; does not call dependencies."""
    return success({"service": "gempa-dbscan-backend", "status": "alive"})


@health_bp.get("/api/health/ready")
def readiness():
    """Check PostgreSQL and Redis before accepting application traffic."""
    checks = {"postgresql": "ok", "redis": "ok"}
    failures = {}

    try:
        db.session.execute(text("SELECT 1"))
    except Exception as exc:  # public response intentionally hides details
        current_app.logger.exception("readiness_postgresql_failed")
        checks["postgresql"] = "error"
        failures["postgresql"] = type(exc).__name__
        db.session.rollback()

    try:
        current_app.extensions["redis"].ping()
    except RedisError as exc:
        current_app.logger.exception("readiness_redis_failed")
        checks["redis"] = "error"
        failures["redis"] = type(exc).__name__

    if failures:
        return error(
            message="Satu atau lebih dependency belum siap.",
            code="SERVICE_NOT_READY",
            details={"checks": checks, "failures": failures},
            status_code=503,
        )

    return success({"service": "gempa-dbscan-backend", "checks": checks})
