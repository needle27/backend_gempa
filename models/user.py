"""Admin user model."""

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)

from extensions import db
from models.types import BIG_ID


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("username", name="uq_users_username"),
        CheckConstraint("role IN ('admin')", name="ck_users_role"),
        CheckConstraint("failed_login_count >= 0", name="ck_users_failed_login_count"),
    )

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    email = db.Column(String(254), nullable=False)
    username = db.Column(String(100), nullable=False)
    password_hash = db.Column(Text, nullable=False)
    role = db.Column(String(20), nullable=False, server_default=text("'admin'"))
    is_active = db.Column(db.Boolean, nullable=False, server_default=text("true"))
    failed_login_count = db.Column(db.Integer, nullable=False, server_default=text("0"))
    locked_until = db.Column(DateTime(timezone=True))
    last_login_at = db.Column(DateTime(timezone=True))
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = db.Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
