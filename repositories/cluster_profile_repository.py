from sqlalchemy import delete, select

from models.cluster_profile import ClusterProfile
from repositories.base import BaseRepository


class ClusterProfileRepository(BaseRepository):
    model = ClusterProfile

    def delete_for_run(self, run_id):
        result = self.session.execute(
            delete(ClusterProfile).where(ClusterProfile.dbscan_run_id == run_id)
        )
        return result.rowcount or 0

    def list_for_run(self, run_id):
        return list(
            self.session.scalars(
                select(ClusterProfile)
                .where(ClusterProfile.dbscan_run_id == run_id)
                .order_by(ClusterProfile.cluster_id.asc())
            )
        )
