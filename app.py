"""Flask application factory for the WebGIS Gempa Bumi DBSCAN backend."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from flask import Flask, g, request
from flask_cors import CORS
from redis import Redis
from redis.exceptions import RedisError

from config import load_config, validate_config
from extensions import db, jwt, limiter, migrate
# Register every ORM model before Flask-Migrate inspects SQLAlchemy metadata.
import models  # noqa: F401,E402
from routes.health import health_bp
from routes.auth import auth_bp
from routes.admin_datasets import admin_datasets_bp
from routes.admin_jobs import admin_jobs_bp
from routes.admin_runs import admin_runs_bp
from routes.public_historical import public_historical_bp
from routes.admin_support import admin_support_bp
from routes.public_realtime import public_realtime_bp
from utils.errors import register_error_handlers
from utils.logging_config import configure_logging


def create_app(config_name: str | Mapping[str, Any] | None = None) -> Flask:
    """Create and configure a Flask application instance.

    ``config_name`` may be ``development``, ``testing``, ``production``, or a
    mapping used to override configuration (primarily useful in tests).
    """
    app = Flask(__name__)
    load_config(app, config_name)
    validate_config(app)
    configure_logging(app)

    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)
    jwt.init_app(app)
    limiter.init_app(app)

    CORS(
        app,
        origins=app.config["FRONTEND_ORIGINS"],
        supports_credentials=True,
        allow_headers=["Content-Type", "X-CSRF-TOKEN", "X-Request-ID"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        expose_headers=["X-Request-ID"],
    )

    redis_kwargs: dict[str, Any] = {
        "decode_responses": True,
        "socket_connect_timeout": app.config["REDIS_CONNECT_TIMEOUT_SECONDS"],
        "socket_timeout": app.config["REDIS_SOCKET_TIMEOUT_SECONDS"],
    }
    if str(app.config.get("REDIS_URL", "")).startswith("rediss://"):
        redis_kwargs["ssl_cert_reqs"] = None

    redis_client = Redis.from_url(
        app.config["REDIS_URL"],
        **redis_kwargs,
    )
    app.extensions["redis"] = redis_client

    @app.before_request
    def assign_request_id() -> None:
        # Accept a caller-supplied ID only when it is a short, safe printable token.
        candidate = request.headers.get("X-Request-ID", "").strip()
        if candidate and len(candidate) <= 128 and candidate.isprintable():
            g.request_id = candidate
        else:
            import uuid

            g.request_id = str(uuid.uuid4())

    @app.after_request
    def add_request_id_header(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        return response

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_datasets_bp)
    app.register_blueprint(admin_jobs_bp)
    app.register_blueprint(admin_runs_bp)
    app.register_blueprint(public_historical_bp)
    app.register_blueprint(admin_support_bp)
    app.register_blueprint(public_realtime_bp)
    register_error_handlers(app)

    # Keep the Redis client reachable for readiness checks and later services.
    app.extensions["redis_error_type"] = RedisError

    from celery_app import create_celery_app

    app.extensions["celery"] = create_celery_app(app)

    from tasks import register_tasks
    register_tasks(app.extensions["celery"])

    return app
