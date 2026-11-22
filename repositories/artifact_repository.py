from sqlalchemy import select

from models.artifact import ProcessingArtifact
from repositories.base import BaseRepository


class ArtifactRepository(BaseRepository):
    model = ProcessingArtifact

    def list_for_dataset(self, dataset_id, *, page=1, per_page=50):
        return list(
            self.session.scalars(
                select(ProcessingArtifact)
                .where(ProcessingArtifact.dataset_id == dataset_id)
                .order_by(ProcessingArtifact.created_at.desc())
                .offset((max(page, 1) - 1) * min(max(per_page, 1), 500))
                .limit(min(max(per_page, 1), 500))
            )
        )

    def list_for_job(self, job_id):
        return list(
            self.session.scalars(
                select(ProcessingArtifact)
                .where(ProcessingArtifact.job_id == job_id)
                .order_by(ProcessingArtifact.created_at.asc(), ProcessingArtifact.id.asc())
            )
        )
