from sqlalchemy import func, select

from models.job import ProcessingJob
from repositories.base import BaseRepository


class JobRepository(BaseRepository):
    model = ProcessingJob

    def get_for_update(self, job_id):
        """Lock a Job row while applying a lifecycle state transition."""
        return self.session.scalar(
            select(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .with_for_update()
        )

    def get_by_celery_task_id(self, task_id):
        if not task_id:
            return None
        return self.session.scalar(
            select(ProcessingJob).where(ProcessingJob.celery_task_id == task_id)
        )

    def list_for_dataset(self, dataset_id, *, page=1, per_page=50):
        return list(
            self.session.scalars(
                select(ProcessingJob)
                .where(ProcessingJob.dataset_id == dataset_id)
                .order_by(ProcessingJob.created_at.desc())
                .offset((max(page, 1) - 1) * min(max(per_page, 1), 500))
                .limit(min(max(per_page, 1), 500))
            )
        )

    def list_jobs(self, *, page=1, per_page=20, status=None, job_type=None, dataset_id=None):
        """Return one page of jobs and the total number matching the filters."""
        page = max(int(page), 1)
        per_page = min(max(int(per_page), 1), 100)

        filters = []
        if status:
            filters.append(ProcessingJob.status == status)
        if job_type:
            filters.append(ProcessingJob.job_type == job_type)
        if dataset_id is not None:
            filters.append(ProcessingJob.dataset_id == dataset_id)

        statement = select(ProcessingJob)
        count_statement = select(func.count()).select_from(ProcessingJob)
        if filters:
            statement = statement.where(*filters)
            count_statement = count_statement.where(*filters)

        statement = (
            statement
            .order_by(ProcessingJob.created_at.desc(), ProcessingJob.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        jobs = list(self.session.scalars(statement))
        total = self.session.scalar(count_statement) or 0
        return jobs, int(total)

