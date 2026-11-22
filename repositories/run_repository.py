from sqlalchemy import select, update

from models.run import DBSCANRun
from repositories.base import BaseRepository


class RunRepository(BaseRepository):
    model = DBSCANRun

    def get_active(self):
        return self.session.scalar(
            select(DBSCANRun).where(
                DBSCANRun.is_active.is_(True),
                DBSCANRun.status == "SUCCESS",
            )
        )

    def get_for_update(self, run_id):
        return self.session.scalar(
            select(DBSCANRun).where(DBSCANRun.id == run_id).with_for_update()
        )

    def list_for_dataset(self, dataset_id, *, page=1, per_page=50):
        return list(
            self.session.scalars(
                select(DBSCANRun)
                .where(DBSCANRun.dataset_id == dataset_id)
                .order_by(DBSCANRun.created_at.desc())
                .offset((max(page, 1) - 1) * min(max(per_page, 1), 500))
                .limit(min(max(per_page, 1), 500))
            )
        )

    def deactivate_all_active(self):
        result = self.session.execute(
            update(DBSCANRun)
            .where(DBSCANRun.is_active.is_(True))
            .values(is_active=False)
            .execution_options(synchronize_session=False)
        )
        return result.rowcount or 0
