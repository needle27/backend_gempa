"""Portable SQLAlchemy types used by the database models."""

from __future__ import annotations

import ipaddress

from sqlalchemy import BigInteger, Integer, JSON, String
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.types import TypeDecorator

# Keep BIGINT in PostgreSQL and use INTEGER's rowid/autoincrement behavior in SQLite tests.
BIG_ID = BigInteger().with_variant(Integer, "sqlite")
# PostgreSQL stores JSONB; SQLite uses its JSON implementation for unit tests.
JSON_DOCUMENT = JSON().with_variant(JSONB(), "postgresql")


class IPAddress(TypeDecorator):
    """Store PostgreSQL INET while remaining testable on SQLite."""

    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(INET())
        return dialect.type_descriptor(String(45))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        try:
            return str(ipaddress.ip_address(str(value)))
        except ValueError as exc:
            raise ValueError(
                "ip_address harus berupa alamat IPv4 atau IPv6 yang valid"
            ) from exc
