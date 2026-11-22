"""Read and write access for append-only administrative audit records."""
from sqlalchemy import func, or_, select

from models.audit_log import AuditLog
from models.user import User
from repositories.base import BaseRepository


class AuditLogRepository(BaseRepository):
    model = AuditLog

    def list_recent(self, *, page=1, per_page=100):
        per_page = min(max(int(per_page), 1), 500)
        page = max(int(page), 1)
        return list(
            self.session.scalars(
                select(AuditLog)
                .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        )

    def list_filtered(
        self,
        *,
        page=1,
        per_page=50,
        action=None,
        entity_type=None,
        entity_id=None,
        user_id=None,
        created_after=None,
        created_before=None,
        query=None,
    ):
        page = max(int(page), 1)
        per_page = min(max(int(per_page), 1), 200)
        conditions = []

        if action:
            conditions.append(AuditLog.action.ilike(f"%{action}%"))
        if entity_type:
            conditions.append(AuditLog.entity_type.ilike(f"%{entity_type}%"))
        if entity_id is not None:
            conditions.append(AuditLog.entity_id == entity_id)
        if user_id is not None:
            conditions.append(AuditLog.user_id == user_id)
        if created_after is not None:
            conditions.append(AuditLog.created_at >= created_after)
        if created_before is not None:
            conditions.append(AuditLog.created_at <= created_before)
        if query:
            pattern = f"%{query}%"
            conditions.append(
                or_(
                    AuditLog.action.ilike(pattern),
                    AuditLog.entity_type.ilike(pattern),
                    User.username.ilike(pattern),
                    User.email.ilike(pattern),
                )
            )

        joins = select(AuditLog, User.username, User.email).outerjoin(
            User, User.id == AuditLog.user_id
        )
        if conditions:
            joins = joins.where(*conditions)
        joins = (
            joins.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )

        count_statement = select(func.count(AuditLog.id)).select_from(AuditLog).outerjoin(
            User, User.id == AuditLog.user_id
        )
        if conditions:
            count_statement = count_statement.where(*conditions)
        total = int(self.session.scalar(count_statement) or 0)
        return list(self.session.execute(joins).all()), total
