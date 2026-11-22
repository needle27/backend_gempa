"""Celery task for final Haversine DBSCAN clustering."""

from flask import current_app
from redis.exceptions import RedisError
from sqlalchemy.exc import OperationalError

from repositories.job_repository import JobRepository
from repositories.run_repository import RunRepository
from services.dbscan_run_service import DBSCANRunService
from services.exceptions import (
    ConflictError,
    NotFoundError,
    ValidationError,
    JobPaused,
    JobCancelled,
)
from tasks.task_utils import (
    dataset_job_lock,
    mark_job_failed,
    reset_job_for_retry,
    job_checkpoint,
    mark_job_running,
)


def register_final_clustering_task(celery):

    @celery.task(
        bind=True,
        name="tasks.final_clustering",
        max_retries=3,
    )
    def run_final_clustering(
        self,
        *,
        job_id,
        run_id,
        dataset_id,
        experiment_id,
        depth_thresholds_km=None,
    ):
        # Compatibility only: older queued Celery messages may still contain
        # this keyword. Depth thresholds are no longer an input to final run.
        try:
            # 1. Retrieve job and run inside exception handling.
            job = JobRepository().get(job_id)
            if job is None:
                raise NotFoundError("Processing job tidak ditemukan.")

            run = RunRepository().get(run_id)
            if run is None:
                raise NotFoundError("Run DBSCAN tidak ditemukan.")

            # 2. Validate job, run, experiment, and dataset relations.
            if (
                job.dataset_id != dataset_id
                or job.run_id != run_id
                or job.job_type != "FINAL_CLUSTERING"
                or run.dataset_id != dataset_id
                or run.selected_experiment_id != experiment_id
            ):
                raise ValidationError(
                    "Relasi job, run, eksperimen, dan dataset " "tidak konsisten."
                )

            # 3. Idempotency protection.
            if run.status == "SUCCESS" and job.status == "SUCCESS":
                return {
                    "job_id": job.id,
                    "run_id": run.id,
                    "status": "SUCCESS",
                    "idempotent": True,
                }

            # 4. Reject terminal job states.
            if job.status == "CANCELLED":
                return {
                    "job_id": job.id,
                    "run_id": run.id,
                    "status": "CANCELLED",
                    "revoked": True,
                }
            if job.status == "FAILED":
                raise ConflictError(
                    f"Job tidak dapat dijalankan dari " f"status {job.status}."
                )

            if run.status == "SUCCESS":
                raise ConflictError(
                    "Run sudah SUCCESS tetapi status job "
                    "belum SUCCESS. Diperlukan rekonsiliasi."
                )

            # 5. Acquire Redis distributed lock.
            with dataset_job_lock(
                "FINAL_CLUSTERING",
                dataset_id,
            ) as acquired:

                if not acquired:
                    return {
                        "job_id": job.id,
                        "run_id": run.id,
                        "status": job.status,
                        "duplicate_delivery": True,
                    }

                # 6. Move the queued job into RUNNING and honor requests before work.
                mark_job_running(
                    job.id,
                    message="Final clustering sedang berjalan.",
                )
                job_checkpoint(job.id, stage="TASK_STARTED", progress=1)

                # 7. Report initial progress.
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "job_id": job.id,
                        "run_id": run.id,
                        "progress": 1,
                        "stage": "FINAL_CLUSTERING",
                    },
                )

                # 7. Execute final Haversine DBSCAN.
                result = DBSCANRunService().execute_final_clustering(
                    dataset_id=dataset_id,
                    experiment_id=experiment_id,
                    created_by=job.created_by,
                    celery_task_id=self.request.id,
                    run_id=run_id,
                    job_id=job_id,
                    checkpoint_callback=lambda **state: job_checkpoint(
                        job.id, **state
                    ),
                )

                # 8. Retrieve final results.
                final_run = result["run"]

                # 9. Report successful completion.
                self.update_state(
                    state="SUCCESS",
                    meta={
                        "job_id": job.id,
                        "run_id": run.id,
                        "progress": 100,
                        "cluster_count": final_run.cluster_count,
                        "noise_count": final_run.noise_count,
                    },
                )

                return {
                    "job_id": job.id,
                    "run_id": run.id,
                    "status": "SUCCESS",
                    "cluster_count": final_run.cluster_count,
                    "noise_count": final_run.noise_count,
                }

        except (JobPaused, JobCancelled):
            from extensions import db
            db.session.expire_all()
            current = JobRepository().get(job_id)
            return {
                "job_id": job_id,
                "run_id": run_id,
                "status": current.status if current is not None else "CANCELLED",
                "checkpoint": current.checkpoint_data if current is not None else {},
            }

        # 10. Handle temporary PostgreSQL or Redis failures.
        except (OperationalError, RedisError) as exc:

            if self.request.retries >= self.max_retries:

                try:
                    mark_job_failed(
                        job_id,
                        exc,
                        code="TRANSIENT_RETRIES_EXHAUSTED",
                        run_id=run_id,
                    )
                except Exception:
                    current_app.logger.exception(
                        "final_clustering_failure_persist_failed",
                        extra={
                            "job_id": job_id,
                            "run_id": run_id,
                        },
                    )

                raise

            # Reset job and run before retrying.
            try:
                reset_job_for_retry(
                    job_id,
                    run_id=run_id,
                )
            except Exception:
                current_app.logger.exception(
                    "final_clustering_retry_reset_failed",
                    extra={
                        "job_id": job_id,
                        "run_id": run_id,
                    },
                )

            raise self.retry(
                exc=exc,
                countdown=min(
                    2 ** (self.request.retries + 1),
                    30,
                ),
            )

        # 11. Handle permanent processing failures.
        except Exception as exc:

            try:
                mark_job_failed(
                    job_id,
                    exc,
                    code="FINAL_CLUSTERING_FAILED",
                    run_id=run_id,
                )
            except Exception:
                current_app.logger.exception(
                    "final_clustering_failure_persist_failed",
                    extra={
                        "job_id": job_id,
                        "run_id": run_id,
                    },
                )

            raise

    return run_final_clustering
