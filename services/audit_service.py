from extensions import db
from models.audit_log import AuditLog
from repositories.audit_log_repository import AuditLogRepository


class AuditService:
    def __init__(self, repository=None):
        self.repository = repository or AuditLogRepository()

    def record(
        self,
        *,
        action,
        user_id=None,
        entity_type=None,
        entity_id=None,
        details=None,
        ip_address=None,
        user_agent=None,
        commit=True,
    ):
        entry = AuditLog(
            user_id=user_id,
            action=str(action)[:100],
            entity_type=str(entity_type)[:50] if entity_type else None,
            entity_id=entity_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.repository.add(entry)
        if commit:
            db.session.commit()
        return entry
