"""Retry helpers for transient database failures in serverless environments."""
from __future__ import annotations

import logging
import random
import time
from collections.abc import Callable
from typing import TypeVar

from flask import current_app, has_app_context
from sqlalchemy.exc import DisconnectionError, InterfaceError, OperationalError

from extensions import db

T = TypeVar("T")
logger = logging.getLogger(__name__)

_TRANSIENT_DB_ERRORS = (OperationalError, InterfaceError, DisconnectionError)


def _dispose_non_memory_engine() -> None:
    """Clear stale PostgreSQL sockets without destroying SQLite :memory: test DBs."""
    try:
        engine = db.engine
        if str(engine.url.drivername).startswith("postgresql"):
            engine.dispose()
    except Exception:
        pass


def run_read_with_retry(
    operation: Callable[[], T],
    *,
    max_attempts: int = 3,
    base_delay_seconds: float = 0.25,
) -> T:
    """Execute a read-only database query with retry on transient connection failures."""
    attempts = max(1, int(max_attempts))
    is_testing = has_app_context() and bool(current_app.config.get("TESTING"))
    delay_base = 0.0 if is_testing else max(0.0, float(base_delay_seconds))

    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except _TRANSIENT_DB_ERRORS as exc:
            db.session.rollback()
            db.session.remove()
            _dispose_non_memory_engine()
            if attempt >= attempts:
                raise
            logger.warning(
                "transient_db_retry attempt=%s max_attempts=%s error=%s",
                attempt,
                attempts,
                type(exc).__name__,
            )
            if delay_base > 0:
                backoff = delay_base * (2 ** (attempt - 1)) + random.uniform(0.0, 0.15)
                time.sleep(backoff)
    raise RuntimeError("Unreachable retry loop termination")
