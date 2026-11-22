"""Execute a final Haversine DBSCAN run and publish one global active run."""

from collections import Counter

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import haversine_distances

from extensions import db
from models.cluster_profile import ClusterProfile
from models.job import ProcessingJob
from models.membership import DBSCANMembership
from models.run import DBSCANRun
from repositories.dataset_repository import DatasetRepository
from repositories.earthquake_repository import EarthquakeRepository
from repositories.experiment_repository import ExperimentRepository
from repositories.job_repository import JobRepository
from repositories.membership_repository import MembershipRepository
from repositories.cluster_profile_repository import ClusterProfileRepository
from repositories.run_repository import RunRepository
from services.exceptions import ConflictError, NotFoundError, ValidationError, JobPaused, JobCancelled
from services.utils import EARTH_RADIUS_KM, utc_now
from services.clustering_evaluation_service import ClusteringEvaluationService


# Fixed descriptive depth bands used only for cluster profiling.
# These values do not participate in DBSCAN distance or feature construction.
SHALLOW_DEPTH_MAX_KM = 70.0
INTERMEDIATE_DEPTH_MAX_KM = 300.0


class DBSCANRunService:
    def __init__(
        self,
        dataset_repository=None,
        earthquake_repository=None,
        experiment_repository=None,
        run_repository=None,
        job_repository=None,
        membership_repository=None,
        profile_repository=None,
        *,
        silhouette_max_sample=None,
        random_state=None,
        evaluation_service=None,
    ):
        def configured(name, fallback):
            try:
                from flask import current_app
                return current_app.config.get(name, fallback)
            except (ImportError, RuntimeError):
                return fallback

        silhouette_max_sample = (
            configured("SILHOUETTE_MAX_SAMPLE", 10000)
            if silhouette_max_sample is None else silhouette_max_sample
        )
        random_state = (
            configured("RANDOM_STATE", 42) if random_state is None else random_state
        )
        self.datasets = dataset_repository or DatasetRepository()
        self.earthquakes = earthquake_repository or EarthquakeRepository()
        self.experiments = experiment_repository or ExperimentRepository()
        self.runs = run_repository or RunRepository()
        self.jobs = job_repository or JobRepository()
        self.memberships = membership_repository or MembershipRepository()
        self.profiles = profile_repository or ClusterProfileRepository()
        self.silhouette_max_sample = int(silhouette_max_sample)
        self.random_state = int(random_state)
        self.evaluator = evaluation_service or ClusteringEvaluationService(
            silhouette_max_sample=self.silhouette_max_sample,
            random_state=self.random_state,
        )

    def execute_final_clustering(
        self,
        *,
        dataset_id,
        experiment_id,
        created_by,
        celery_task_id=None,
        run_id=None,
        job_id=None,
        checkpoint_callback=None,
    ):
        dataset = self.datasets.get(dataset_id)
        if dataset is None:
            raise NotFoundError("Dataset tidak ditemukan.")
        experiment = self.experiments.get_for_dataset(experiment_id, dataset_id)
        if experiment is None:
            raise NotFoundError("Eksperimen tidak ditemukan pada dataset tersebut.")
        if not experiment.is_valid:
            raise ValidationError("Eksperimen tidak valid dan tidak dapat digunakan untuk final clustering.")

        events = self.earthquakes.list_by_dataset(dataset_id)
        if not events:
            raise ValidationError("Dataset tidak memiliki kejadian gempa.")

        job = None
        if run_id is not None:
            run = self.runs.get_for_update(run_id)
            if run is None:
                raise NotFoundError("Run DBSCAN tidak ditemukan.")
            if run.dataset_id != dataset_id or run.selected_experiment_id != experiment.id:
                raise ValidationError("Run tidak cocok dengan dataset atau eksperimen yang dipilih.")
            if run.status == "SUCCESS":
                existing_job = self.jobs.get(job_id) if job_id is not None else None
                return {
                    "run": run,
                    "job": existing_job,
                    "profiles": self.profiles.list_for_run(run.id),
                }
            if run.status not in {"DRAFT", "CLUSTERING"}:
                raise ConflictError(f"Run tidak dapat diproses dari status {run.status}.")
            if job_id is None:
                raise ValidationError("job_id wajib untuk run yang dibuat oleh API.")
            job = self.jobs.get(job_id)
            if job is None:
                raise NotFoundError("Processing job tidak ditemukan.")
            if (
                job.dataset_id != dataset_id
                or job.run_id != run.id
                or job.job_type != "FINAL_CLUSTERING"
            ):
                raise ValidationError("Job tidak cocok dengan run atau dataset.")
            if job.status == "SUCCESS" and run.status == "SUCCESS":
                return {
                    "run": run,
                    "job": job,
                    "profiles": self.profiles.list_for_run(run.id),
                }
            if job.status not in {
                "QUEUED", "RUNNING", "PAUSE_REQUESTED", "STOP_REQUESTED"
            }:
                raise ConflictError(f"Job tidak dapat dijalankan dari status {job.status}.")

            # Idempotent retry: remove any previous partial output before recomputing.
            self.memberships.delete_for_run(run.id)
            self.profiles.delete_for_run(run.id)
            run.status = "CLUSTERING"
            run.is_active = False
            run.completed_at = None
            job.status = "RUNNING"
            job.celery_task_id = celery_task_id or job.celery_task_id
            job.progress = max(int(job.progress or 0), 1)
            job.current_step = "FINAL_CLUSTERING"
            job.message = "Final clustering sedang berjalan."
            job.started_at = job.started_at or utc_now()
        else:
            run = DBSCANRun(
                dataset_id=dataset_id,
                selected_experiment_id=experiment.id,
                eps_km=float(experiment.eps_km),
                eps_radian=float(experiment.eps_radian),
                min_samples=int(experiment.min_samples),
                metric="haversine",
                earth_radius_km=EARTH_RADIUS_KM,
                status="CLUSTERING",
                is_active=False,
                created_by=created_by,
            )
            db.session.add(run)
            db.session.flush()
            job = ProcessingJob(
                dataset_id=dataset_id,
                run_id=run.id,
                job_type="FINAL_CLUSTERING",
                celery_task_id=celery_task_id,
                status="RUNNING",
                progress=0,
                current_step="FINAL_CLUSTERING",
                message="Final clustering sedang berjalan.",
                created_by=created_by,
                started_at=utc_now(),
            )
            db.session.add(job)

        try:
            db.session.commit()

            coordinates_deg = np.asarray(
                [(float(event.latitude), float(event.longitude)) for event in events],
                dtype=float,
            )
            coordinates_rad = np.radians(coordinates_deg)
            if checkpoint_callback is not None:
                checkpoint_callback(
                    stage="FINAL_DBSCAN_BEFORE_FIT",
                    progress=5,
                )
            labels = DBSCAN(
                eps=float(experiment.eps_radian),
                min_samples=int(experiment.min_samples),
                metric="haversine",
                algorithm="ball_tree",
            ).fit_predict(coordinates_rad)
            if checkpoint_callback is not None:
                # Labels are intentionally not persisted as a checkpoint artifact.
                # Resume therefore safely recomputes this deterministic fit.
                checkpoint_callback(
                    stage="FINAL_DBSCAN_FIT_NOT_PERSISTED_RECOMPUTE_ON_RESUME",
                    progress=55,
                )
                # job_checkpoint commits the checkpoint; reload ORM event rows once
                # so the following profile/membership pass does not trigger N+1 refreshes.
                events = self.earthquakes.list_by_dataset(dataset_id)

            memberships = []
            for event, raw_label in zip(events, labels):
                label = int(raw_label)
                memberships.append(
                    DBSCANMembership(
                        dataset_id=dataset_id,
                        dbscan_run_id=run.id,
                        gempa_id=event.id,
                        cluster_id=label,
                        is_noise=(label == -1),
                    )
                )
            self.memberships.add_many(memberships)

            cluster_labels = sorted(int(value) for value in set(labels) if value >= 0)
            profiles = []
            for cluster_id in cluster_labels:
                indices = np.flatnonzero(labels == cluster_id)
                members = [events[int(index)] for index in indices]
                cluster_coords_rad = coordinates_rad[indices]

                centroid_lat = float(np.mean([item.latitude for item in members]))
                centroid_lon = float(np.mean([item.longitude for item in members]))
                centroid_rad = np.radians([[centroid_lat, centroid_lon]])
                distances_km = (
                    haversine_distances(cluster_coords_rad, centroid_rad).reshape(-1)
                    * EARTH_RADIUS_KM
                )

                magnitudes = [float(item.magnitude) for item in members]
                depths = [float(item.kedalaman) for item in members if item.kedalaman is not None]
                locations = [item.lokasi.strip() for item in members if item.lokasi and item.lokasi.strip()]
                dominant_location = Counter(locations).most_common(1)[0][0] if locations else None

                # Depth is descriptive profile data only. It is not included
                # in coordinates_rad or DBSCAN.fit_predict().
                shallow_count = sum(
                    value < SHALLOW_DEPTH_MAX_KM for value in depths
                )
                medium_count = sum(
                    SHALLOW_DEPTH_MAX_KM <= value < INTERMEDIATE_DEPTH_MAX_KM
                    for value in depths
                )
                deep_count = sum(
                    value >= INTERMEDIATE_DEPTH_MAX_KM for value in depths
                )

                profiles.append(
                    ClusterProfile(
                        dbscan_run_id=run.id,
                        cluster_id=cluster_id,
                        event_count=len(members),
                        avg_magnitude=float(np.mean(magnitudes)),
                        min_magnitude=float(np.min(magnitudes)),
                        max_magnitude=float(np.max(magnitudes)),
                        avg_depth=float(np.mean(depths)) if depths else None,
                        min_depth=float(np.min(depths)) if depths else None,
                        max_depth=float(np.max(depths)) if depths else None,
                        shallow_event_count=int(shallow_count),
                        medium_event_count=int(medium_count),
                        deep_event_count=int(deep_count),
                        first_event_date=min(item.tanggal for item in members),
                        last_event_date=max(item.tanggal for item in members),
                        centroid_latitude=centroid_lat,
                        centroid_longitude=centroid_lon,
                        dominant_location=dominant_location,
                        radius_km=float(np.mean(distances_km)),
                        max_radius_km=float(np.max(distances_km)),
                    )
                )
            self.profiles.add_many(profiles)

            cluster_count = len(cluster_labels)
            noise_count = int(np.sum(labels == -1))
            total_points = len(labels)
            evaluation = self.evaluator.evaluate(coordinates_rad, labels)

            run.cluster_count = cluster_count
            run.noise_count = noise_count
            run.noise_percentage = noise_count / total_points * 100.0
            run.total_points = total_points
            run.silhouette_score = evaluation["silhouette_score"]
            run.silhouette_sample_size = evaluation["silhouette_sample_size"]
            run.dbi_score = evaluation["dbi_score"]
            run.dbcv_score = evaluation["dbcv_score"]
            run.evaluation_metadata = evaluation["evaluation_metadata"]

            # Serialize the terminal transition with Pause/Stop requests. Pending
            # memberships/profiles are still uncommitted and can be rolled back.
            locked_job = self.jobs.get_for_update(job.id)
            if locked_job is None:
                raise NotFoundError("Processing job tidak ditemukan.")
            db.session.refresh(locked_job, with_for_update=True)
            if locked_job.status in {"PAUSE_REQUESTED", "STOP_REQUESTED"}:
                db.session.rollback()
                if checkpoint_callback is not None:
                    checkpoint_callback(
                        stage="FINAL_OUTPUT_NOT_COMMITTED_RECOMPUTE_ON_RESUME",
                        progress=95,
                    )
                raise JobPaused("Lifecycle request diterima sebelum final commit.")
            job = locked_job

            run.status = "SUCCESS"
            run.completed_at = utc_now()
            job.status = "SUCCESS"
            job.progress = 100
            job.current_step = "COMPLETED"
            job.finished_at = utc_now()
            job.message = "Final clustering selesai."
            db.session.commit()
            return {"run": run, "job": job, "profiles": profiles}
        except (JobPaused, JobCancelled):
            db.session.rollback()
            controlled_run = self.runs.get(run.id) if run.id else None
            if controlled_run is not None and controlled_run.status != "SUCCESS":
                controlled_run.status = "DRAFT"
                controlled_run.is_active = False
                controlled_run.completed_at = None
                db.session.commit()
            raise
        except Exception as exc:
            db.session.rollback()
            failed_run = self.runs.get(run.id) if run.id else None
            failed_job = self.jobs.get(job.id) if job is not None and job.id else None
            if failed_run is not None:
                failed_run.status = "FAILED"
                failed_run.is_active = False
            if failed_job is not None:
                failed_job.status = "FAILED"
                failed_job.finished_at = utc_now()
                failed_job.error_code = "FINAL_CLUSTERING_FAILED"
                failed_job.error_detail = str(exc)[:4000]
                failed_job.message = "Final clustering gagal."
            db.session.commit()
            raise

    def activate_run(self, *, run_id, approved_by):
        run = self.runs.get_for_update(run_id)
        if run is None:
            raise NotFoundError("Run DBSCAN tidak ditemukan.")
        if run.status != "SUCCESS":
            raise ConflictError("Hanya run dengan status SUCCESS yang dapat diaktifkan.")

        try:
            # Deactivate first, then activate the selected run in the same transaction.
            # The PostgreSQL partial unique index remains the final concurrency guard.
            self.runs.deactivate_all_active()
            run.is_active = True
            run.approved_by = approved_by
            run.activated_at = utc_now()
            db.session.commit()
            return run
        except Exception:
            db.session.rollback()
            raise
