"""Read-only data projection for public WebGIS endpoints."""

from repositories.dataset_repository import DatasetRepository
from repositories.earthquake_repository import EarthquakeRepository
from repositories.run_repository import RunRepository
from repositories.cluster_profile_repository import ClusterProfileRepository
from services.exceptions import NotFoundError, ValidationError


class WebGISService:
    def __init__(
        self,
        run_repository=None,
        dataset_repository=None,
        earthquake_repository=None,
        profile_repository=None,
    ):
        self.runs = run_repository or RunRepository()
        self.datasets = dataset_repository or DatasetRepository()
        self.earthquakes = earthquake_repository or EarthquakeRepository()
        self.profiles = profile_repository or ClusterProfileRepository()

    def _active_context(self):
        run = self.runs.get_active()
        if run is None:
            raise NotFoundError("Belum ada hasil DBSCAN yang dipublikasikan.")
        dataset = self.datasets.get(run.dataset_id)
        if dataset is None:
            raise NotFoundError("Dataset milik run aktif tidak ditemukan.")
        return run, dataset

    def get_metadata(self):
        run, dataset = self._active_context()
        return {
            "dataset": {
                "id": dataset.id,
                "name": dataset.dataset_name,
                "source_name": dataset.source_name,
                "start_date": dataset.start_date.isoformat(),
                "end_date": dataset.end_date.isoformat(),
                "raw_row_count": dataset.raw_row_count,
                "cleaned_row_count": dataset.cleaned_row_count,
            },
            "run": {
                "id": run.id,
                "status": run.status,
                "eps_km": run.eps_km,
                "eps_radian": run.eps_radian,
                "min_samples": run.min_samples,
                "metric": run.metric,
                "earth_radius_km": run.earth_radius_km,
                "silhouette_score": run.silhouette_score,
                "silhouette_sample_size": run.silhouette_sample_size,
                "dbi_score": run.dbi_score,
                "dbcv_score": run.dbcv_score,
                "evaluation_metadata": run.evaluation_metadata or {},
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                "activated_at": run.activated_at.isoformat() if run.activated_at else None,
            },
        }

    def get_summary(self):
        run, dataset = self._active_context()
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.dataset_name,
            "total_points": run.total_points or 0,
            "cluster_count": run.cluster_count or 0,
            "noise_count": run.noise_count or 0,
            "noise_percentage": run.noise_percentage or 0.0,
            "silhouette_score": run.silhouette_score,
            "silhouette_sample_size": run.silhouette_sample_size,
            "dbi_score": run.dbi_score,
            "dbcv_score": run.dbcv_score,
            "evaluation_metadata": run.evaluation_metadata or {},
            "profile_count": self.profiles.count(dbscan_run_id=run.id),
        }

    def get_profiles(self):
        run, _ = self._active_context()
        profiles = self.profiles.list_for_run(run.id)
        return [
            {
                "cluster_id": item.cluster_id,
                "event_count": item.event_count,
                "avg_magnitude": item.avg_magnitude,
                "min_magnitude": item.min_magnitude,
                "max_magnitude": item.max_magnitude,
                "avg_depth": item.avg_depth,
                "min_depth": item.min_depth,
                "max_depth": item.max_depth,
                "shallow_event_count": item.shallow_event_count,
                "medium_event_count": item.medium_event_count,
                "deep_event_count": item.deep_event_count,
                "first_event_date": item.first_event_date.isoformat() if item.first_event_date else None,
                "last_event_date": item.last_event_date.isoformat() if item.last_event_date else None,
                "centroid_latitude": item.centroid_latitude,
                "centroid_longitude": item.centroid_longitude,
                "dominant_location": item.dominant_location,
                "radius_km": item.radius_km,
                "max_radius_km": item.max_radius_km,
            }
            for item in profiles
        ]

    def get_earthquakes(
        self,
        *,
        page=1,
        per_page=500,
        min_lat=None,
        max_lat=None,
        min_lon=None,
        max_lon=None,
        cluster_id=None,
    ):
        run, _ = self._active_context()
        page = max(int(page), 1)
        per_page = min(max(int(per_page), 1), 5000)
        bounds = (min_lat, max_lat, min_lon, max_lon)
        if any(value is not None for value in bounds):
            if min_lat is not None and max_lat is not None and min_lat > max_lat:
                raise ValidationError("min_lat tidak boleh lebih besar dari max_lat.")
            if min_lon is not None and max_lon is not None and min_lon > max_lon:
                raise ValidationError("min_lon tidak boleh lebih besar dari max_lon.")

        rows = self.earthquakes.list_for_run(
            run.id,
            offset=(page - 1) * per_page,
            limit=per_page,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            cluster_id=cluster_id,
        )
        return [
            {
                "id": event.id,
                "event_id": event.event_id,
                "tanggal": event.tanggal.isoformat(),
                "latitude": event.latitude,
                "longitude": event.longitude,
                "magnitude": event.magnitude,
                "kedalaman": event.kedalaman,
                "lokasi": event.lokasi,
                "cluster_id": int(label),
                "is_noise": bool(is_noise),
            }
            for event, label, is_noise in rows
        ]
