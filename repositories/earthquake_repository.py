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

    def _run_points_query(
        self,
        statement,
        *,
        run_id,
        offset=0,
        limit=500,
        min_lat=None,
        max_lat=None,
        min_lon=None,
        max_lon=None,
        cluster_id=None,
    ):
        statement = statement.join(
            DBSCANMembership,
            (DBSCANMembership.gempa_id == Earthquake.id)
            & (DBSCANMembership.dataset_id == Earthquake.dataset_id),
        ).where(DBSCANMembership.dbscan_run_id == run_id)
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
        # Order by DBSCANMembership.gempa_id (identical to Earthquake.id) so PostgreSQL
        # can leverage uq_membership_run_gempa (dbscan_run_id, gempa_id) index order.
        return (
            statement.order_by(DBSCANMembership.gempa_id.asc())
            .offset(max(offset, 0))
            .limit(min(max(limit, 1), 5000))
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
        statement = self._run_points_query(
            select(Earthquake, DBSCANMembership.cluster_id, DBSCANMembership.is_noise),
            run_id=run_id,
            offset=offset,
            limit=limit,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            cluster_id=cluster_id,
        )
        return list(self.session.execute(statement))

    def list_points_for_run(
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
        """Lightweight column projection for public map pagination without full ORM hydration."""
        statement = self._run_points_query(
            select(
                Earthquake.id,
                Earthquake.event_id,
                Earthquake.tanggal,
                Earthquake.latitude,
                Earthquake.longitude,
                Earthquake.magnitude,
                Earthquake.kedalaman,
                Earthquake.lokasi,
                DBSCANMembership.cluster_id,
                DBSCANMembership.is_noise,
            ),
            run_id=run_id,
            offset=offset,
            limit=limit,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            cluster_id=cluster_id,
        )
        return list(self.session.execute(statement))
