from sqlalchemy import func, select

from models.earthquake import Earthquake
from models.membership import DBSCANMembership
from repositories.base import BaseRepository


class EarthquakeRepository(BaseRepository):
    model = Earthquake

    def list_by_dataset(self, dataset_id, *, order_by="id"):
        return list(
            self.session.scalars(
                select(Earthquake)
                .where(Earthquake.dataset_id == dataset_id)
                .order_by(getattr(Earthquake, order_by).asc())
            )
        )

    def coordinates_for_dataset(self, dataset_id):
        rows = self.session.execute(
            select(Earthquake.latitude, Earthquake.longitude)
            .where(Earthquake.dataset_id == dataset_id)
            .order_by(Earthquake.id.asc())
        )
        return [(float(lat), float(lon)) for lat, lon in rows]

    def count_for_dataset(self, dataset_id):
        return int(
            self.session.scalar(
                select(func.count()).select_from(Earthquake).where(Earthquake.dataset_id == dataset_id)
            ) or 0
        )

    def list_for_run(
        self,
        run_id,
        *,
        offset=0,
        limit=500,
        min_lat=None,
        max_lat=None,
        min_lon=None,
        max_lon=None,
        cluster_id=None,
    ):
        statement = (
            select(Earthquake, DBSCANMembership.cluster_id, DBSCANMembership.is_noise)
            .join(
                DBSCANMembership,
                (DBSCANMembership.gempa_id == Earthquake.id)
                & (DBSCANMembership.dataset_id == Earthquake.dataset_id),
            )
            .where(DBSCANMembership.dbscan_run_id == run_id)
        )
        if min_lat is not None:
            statement = statement.where(Earthquake.latitude >= min_lat)
        if max_lat is not None:
            statement = statement.where(Earthquake.latitude <= max_lat)
        if min_lon is not None:
            statement = statement.where(Earthquake.longitude >= min_lon)
        if max_lon is not None:
            statement = statement.where(Earthquake.longitude <= max_lon)
        if cluster_id is not None:
            statement = statement.where(DBSCANMembership.cluster_id == cluster_id)
        statement = statement.order_by(Earthquake.id.asc()).offset(max(offset, 0)).limit(min(max(limit, 1), 5000))
        return list(self.session.execute(statement))
