from sqlalchemy import delete, select

from models.membership import DBSCANMembership
from repositories.base import BaseRepository


class MembershipRepository(BaseRepository):
    model = DBSCANMembership

    def delete_for_run(self, run_id):
        result = self.session.execute(
            delete(DBSCANMembership).where(DBSCANMembership.dbscan_run_id == run_id)
        )
        return result.rowcount or 0

    def list_for_run(self, run_id, *, cluster_id=None):
        statement = select(DBSCANMembership).where(DBSCANMembership.dbscan_run_id == run_id)
        if cluster_id is not None:
            statement = statement.where(DBSCANMembership.cluster_id == cluster_id)
        return list(self.session.scalars(statement.order_by(DBSCANMembership.gempa_id.asc())))
