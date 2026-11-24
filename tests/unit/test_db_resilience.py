"""Unit tests for serverless DB engine options and transient read retries."""
from __future__ import annotations

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import NullPool

from config import _build_engine_options, load_config  # noqa: F401
from utils.db_retry import run_read_with_retry


def test_build_engine_options_uses_null_pool_on_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    opts = _build_engine_options("postgresql+psycopg://user:pw@host:5432/db")
    assert opts["poolclass"] is NullPool
    assert opts["connect_args"] == {"connect_timeout": 10}


def test_build_engine_options_uses_pool_outside_vercel(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("DB_NULL_POOL", raising=False)
    opts = _build_engine_options("postgresql+psycopg://user:pw@host:5432/db")
    assert "poolclass" not in opts
    assert opts["pool_pre_ping"] is True
    assert opts["pool_recycle"] == 300
    assert opts["connect_args"] == {"connect_timeout": 10}


def test_build_engine_options_returns_empty_for_sqlite():
    assert _build_engine_options("sqlite:///:memory:") == {}


def test_run_read_with_retry_recovers_from_transient_operational_error(app):
    attempts = 0

    def flaky_operation():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise OperationalError("SELECT 1", {}, Exception("connection reset"))
        return {"ok": True}

    with app.app_context():
        result = run_read_with_retry(flaky_operation, max_attempts=3, base_delay_seconds=0)

    assert result == {"ok": True}
    assert attempts == 3


def test_run_read_with_retry_does_not_retry_non_transient_errors(app):
    attempts = 0

    def bad_operation():
        nonlocal attempts
        attempts += 1
        raise ValueError("not a DB connection error")

    with app.app_context():
        with pytest.raises(ValueError):
            run_read_with_retry(bad_operation, max_attempts=3, base_delay_seconds=0)

    assert attempts == 1


def test_run_read_with_retry_raises_after_exhausting_attempts(app):
    attempts = 0

    def dead_operation():
        nonlocal attempts
        attempts += 1
        raise OperationalError("SELECT 1", {}, Exception("still down"))

    with app.app_context():
        with pytest.raises(OperationalError):
            run_read_with_retry(dead_operation, max_attempts=2, base_delay_seconds=0)

    assert attempts == 2
