from sqlalchemy import select, update

from models.experiment import DBSCANParameterExperiment
from repositories.base import BaseRepository


class ExperimentRepository(BaseRepository):
    model = DBSCANParameterExperiment

    def list_for_job(self, job_id):
        return list(
            self.session.scalars(
                select(DBSCANParameterExperiment)
                .where(DBSCANParameterExperiment.job_id == job_id)
                .order_by(DBSCANParameterExperiment.eps_km, DBSCANParameterExperiment.min_samples)
            )
        )

    def get_for_dataset(self, experiment_id, dataset_id):
        return self.session.scalar(
            select(DBSCANParameterExperiment).where(
                DBSCANParameterExperiment.id == experiment_id,
                DBSCANParameterExperiment.dataset_id == dataset_id,
            )
        )

    def clear_recommendations_for_job(self, job_id):
        self.session.execute(
            update(DBSCANParameterExperiment)
            .where(DBSCANParameterExperiment.job_id == job_id)
            .values(is_recommended=False)
        )
