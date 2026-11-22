"""Append-only audit log model."""

from sqlalchemy import DateTime, ForeignKey, String, Text, func

from extensions import db
from models.types import BIG_ID, JSON_DOCUMENT, IPAddress


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(BIG_ID, primary_key=True, autoincrement=True)
    user_id = db.Column(BIG_ID, ForeignKey("users.id", name="fk_audit_user"))
    action = db.Column(String(100), nullable=False)
    entity_type = db.Column(String(50))
    entity_id = db.Column(BIG_ID)
    details = db.Column(
        JSON_DOCUMENT, nullable=False, default=dict, server_default="{}"
    )
    ip_address = db.Column(IPAddress)
    user_agent = db.Column(Text)
    created_at = db.Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
