"""Environment-backed application configuration."""
from __future__ import annotations

import os
import socket
from collections.abc import Mapping
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_origins(value: str | None) -> list[str]:
    if not value:
        return []
    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


def _as_float_list(value: str | None, default: tuple[float, ...]) -> list[float]:
    if value is None or not value.strip():
        return [float(item) for item in default]
    try:
        return [float(item.strip()) for item in value.split(",") if item.strip()]
    except ValueError as exc:
        raise ValueError("EPSILON_DEFAULT_GRID_KM harus berupa daftar angka dipisahkan koma.") from exc


class BaseConfig:
    APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }

    REDIS_URL = os.getenv("REDIS_URL")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or REDIS_URL
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND") or REDIS_URL
    CELERY_TASK_TRACK_STARTED = True
    CELERY_TASK_ACKS_LATE = True
    CELERY_WORKER_PREFETCH_MULTIPLIER = 1
    CELERY_TASK_SERIALIZER = "json"
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]
    CELERY_TIMEZONE = "UTC"
    CELERY_ENABLE_UTC = True

    FRONTEND_ORIGINS = _as_origins(os.getenv("FRONTEND_ORIGIN"))
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "var/uploads")
    ARTIFACT_DIR = os.getenv("ARTIFACT_DIR", "var/artifacts")

    ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
    REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SECURE = _as_bool(os.getenv("JWT_COOKIE_SECURE"), default=False)
    JWT_COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "Lax")
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"
    JWT_ACCESS_TOKEN_EXPIRES = ACCESS_TOKEN_MINUTES * 60
    JWT_REFRESH_TOKEN_EXPIRES = REFRESH_TOKEN_DAYS * 24 * 60 * 60

    RATELIMIT_STORAGE_URI = REDIS_URL
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_SWALLOW_ERRORS = False

    BMKG_TIMEOUT_SECONDS = float(os.getenv("BMKG_TIMEOUT_SECONDS", "8"))
    BMKG_CACHE_SECONDS = int(os.getenv("BMKG_CACHE_SECONDS", "60"))
    SILHOUETTE_MAX_SAMPLE = int(os.getenv("SILHOUETTE_MAX_SAMPLE", "10000"))
    RANDOM_STATE = int(os.getenv("RANDOM_STATE", "42"))
    EPSILON_DEFAULT_GRID_KM = _as_float_list(
        os.getenv("EPSILON_DEFAULT_GRID_KM"),
        (10, 15, 20, 25, 30, 40, 50, 60, 75, 100),
    )
    EPSILON_ROUNDING_KM = float(os.getenv("EPSILON_ROUNDING_KM", "0.5"))
    EPSILON_USE_DEFAULT_GRID = _as_bool(
        os.getenv("EPSILON_USE_DEFAULT_GRID"), default=True
    )

    # DBSCAN experiment validity thresholds (T6).
    VALIDITY_THRESHOLDS = {
        "min_clusters": int(os.getenv("VALIDITY_MIN_CLUSTERS", "2")),
        "max_clusters": int(os.getenv("VALIDITY_MAX_CLUSTERS", "80")),
        "max_noise_percentage": float(
            os.getenv("VALIDITY_MAX_NOISE_PERCENTAGE", "40.0")
        ),
        "max_largest_cluster_ratio": float(
            os.getenv("VALIDITY_MAX_LARGEST_CLUSTER_RATIO", "0.60")
        ),
    }

    # DBSCAN multicriteria recommendation weights (T8).
    RECOMMENDATION_WEIGHTS = {
        "silhouette": float(os.getenv("RECOMMENDATION_WEIGHT_SILHOUETTE", "0.4")),
        "noise_percentage": float(
            os.getenv("RECOMMENDATION_WEIGHT_NOISE_PERCENTAGE", "0.2")
        ),
        "largest_cluster_ratio": float(
            os.getenv("RECOMMENDATION_WEIGHT_LARGEST_CLUSTER_RATIO", "0.2")
        ),
        "stability_score": float(
            os.getenv("RECOMMENDATION_WEIGHT_STABILITY_SCORE", "0.2")
        ),
    }
    REDIS_CONNECT_TIMEOUT_SECONDS = float(os.getenv("REDIS_CONNECT_TIMEOUT_SECONDS", "2"))
    REDIS_SOCKET_TIMEOUT_SECONDS = float(os.getenv("REDIS_SOCKET_TIMEOUT_SECONDS", "2"))

    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = False


def _get_lan_origins(port: int = 5173) -> list[str]:
    """Auto-detect LAN IP dan kembalikan sebagai allowed origin (dev only)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
        return [f"http://{lan_ip}:{port}"]
    except Exception:
        return []


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    TESTING = False

    # Auto-inject LAN IP saat startup (IP Mac bisa berubah tiap connect)
    FRONTEND_ORIGINS = list(dict.fromkeys(
        _as_origins(os.getenv("FRONTEND_ORIGIN")) + _get_lan_origins(5173)
    ))


class TestingConfig(BaseConfig):
    APP_ENV = "testing"
    TESTING = True
    DEBUG = False
    SECRET_KEY = "test-secret-key-not-for-production"
    JWT_SECRET_KEY = "test-jwt-secret-not-for-production"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    REDIS_URL = "redis://localhost:6379/15"
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = "cache+memory://"
    RATELIMIT_STORAGE_URI = "memory://"
    FRONTEND_ORIGINS = ["http://localhost:5173"]
    JWT_COOKIE_SECURE = False


class ProductionConfig(BaseConfig):
    APP_ENV = "production"
    DEBUG = False
    TESTING = False
    JWT_COOKIE_SECURE = True


_CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def load_config(app, config_name: str | Mapping[str, Any] | None = None) -> None:
    """Load a named config or a dictionary of explicit overrides."""
    if isinstance(config_name, Mapping):
        app.config.from_object(DevelopmentConfig)
        app.config.update(config_name)
        return

    selected = (config_name or os.getenv("APP_ENV", "development")).strip().lower()
    config_class = _CONFIGS.get(selected)
    if config_class is None:
        raise ValueError(f"APP_ENV tidak dikenal: {selected}")
    app.config.from_object(config_class)


def validate_config(app) -> None:
    """Fail fast when required runtime configuration is missing or unsafe."""
    if app.config.get("TESTING"):
        return

    required = ["SECRET_KEY", "JWT_SECRET_KEY", "SQLALCHEMY_DATABASE_URI", "REDIS_URL"]
    missing = [name for name in required if not app.config.get(name)]
    if missing:
        raise RuntimeError(
            "Konfigurasi wajib belum diisi: " + ", ".join(missing) + ". Periksa file .env."
        )

    if not app.config.get("FRONTEND_ORIGINS"):
        raise RuntimeError("FRONTEND_ORIGIN wajib berisi minimal satu origin frontend yang eksplisit.")

    if "*" in app.config["FRONTEND_ORIGINS"]:
        raise RuntimeError("FRONTEND_ORIGIN tidak boleh menggunakan wildcard '*'.")

    if app.config.get("APP_ENV") == "production":
        if not app.config.get("JWT_COOKIE_SECURE"):
            raise RuntimeError("JWT_COOKIE_SECURE harus true pada production.")
        if len(str(app.config["SECRET_KEY"])) < 32 or len(str(app.config["JWT_SECRET_KEY"])) < 32:
            raise RuntimeError("SECRET_KEY dan JWT_SECRET_KEY production minimal 32 karakter.")
