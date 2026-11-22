"""Shared Celery task helpers."""

from contextlib import contextmanager

from flask import current_app
from extensions import db
from repositories.job_repository import JobRepository
from repositories.run_repository import RunRepository
from services.utils import utc_now
from services.exceptions import JobPaused, JobCancelled


@contextmanager
def dataset_job_lock(job_type, dataset_id):
    """Serialize processing for a dataset and job type."""
    if current_app.testing:
        yield True
        return

    redis_client = current_app.extensions["redis"]
    timeout = int(current_app.config.get("CELERY_LOCK_TIMEOUT_SECONDS", 21600))

    lock = redis_client.lock(
        f"webgis:dataset:{dataset_id}:{job_type}",
        timeout=timeout,
        blocking_timeout=0,
    )

    acquired = lock.acquire(blocking=False)

    try:
        yield acquired
    finally:
        if acquired:
            try:
                lock.release()
            except Exception:
                current_app.logger.exception("celery_dataset_lock_release_failed")



def job_checkpoint(job_id, *, stage, progress=None):
    """Persist a cooperative pause/stop request at a safe task boundary."""
    job = JobRepository().get_for_update(job_id)
    if job is not None:
        db.session.refresh(job, with_for_update=True)
    if job is None:
        raise JobCancelled("Processing job tidak ditemukan.")

    if job.status == "STOP_REQUESTED":
        job.status = "CANCELLED"
        job.current_step = "CANCELLED"
        job.finished_at = utc_now()
        job.message = "Job dihentikan pada checkpoint aman."
        job.checkpoint_data = {
            **(job.checkpoint_data or {}),
            "stage": stage,
            "progress": int(job.progress or 0),
        }
        db.session.commit()
        raise JobCancelled("Job dihentikan oleh admin.")

    if job.status == "PAUSE_REQUESTED":
        job.status = "PAUSED"
        job.paused_at = utc_now()
        job.current_step = "PAUSED"
        job.message = f"Job dijeda pada checkpoint: {stage}."
        job.checkpoint_data = {
            "stage": stage,
            "progress": int(job.progress if progress is None else progress),
            "checkpoint_at": utc_now().isoformat(),
        }
        db.session.commit()
        raise JobPaused(f"Job dijeda pada checkpoint {stage}.")

    if job.status in {"PAUSED", "CANCELLED", "FAILED", "SUCCESS"}:
        if job.status == "PAUSED":
            raise JobPaused("Job sudah dijeda.")
        raise JobCancelled(f"Job tidak dapat melanjutkan dari status {job.status}.")

    if progress is not None:
        job.progress = max(int(job.progress or 0), min(int(progress), 99))
    job.current_step = stage
    db.session.commit()
    return job


def mark_job_running(job_id, *, message="Background job sedang berjalan."):
    """Move a queued job to RUNNING without overwriting lifecycle requests."""
    job = JobRepository().get_for_update(job_id)
    if job is not None:
        db.session.refresh(job, with_for_update=True)
    if job is None:
        raise JobCancelled("Processing job tidak ditemukan.")
    if job.status in {"PAUSE_REQUESTED", "STOP_REQUESTED"}:
        job_checkpoint(job_id, stage="BEFORE_START")
    if job.status in {"PAUSED", "CANCELLED", "FAILED", "SUCCESS"}:
        if job.status == "PAUSED":
            raise JobPaused("Job sudah dijeda.")
        raise JobCancelled(f"Job tidak dapat dimulai dari status {job.status}.")
    if job.status == "QUEUED":
        job.status = "RUNNING"
        job.started_at = job.started_at or utc_now()
        job.message = message
        job.current_step = "STARTING"
        db.session.commit()
    return job


def mark_job_failed(job_id, exc, *, code, run_id=None):
    """Persist consistent failure status for job and its matching run."""
    db.session.rollback()

    job = JobRepository().get(job_id)

    if job is None or job.status in {"SUCCESS", "CANCELLED", "PAUSED"}:
        return

    job.status = "FAILED"
    job.finished_at = utc_now()
    job.current_step = "FAILED"
    job.error_code = code
    job.error_detail = str(exc)[:4000]
    job.message = "Background job gagal."

    if run_id is not None:
        run = RunRepository().get(run_id)

        if (
            run is not None
            and job.run_id == run.id
            and job.dataset_id == run.dataset_id
            and run.status != "SUCCESS"
        ):
            run.status = "FAILED"
            run.is_active = False

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception(
            "celery_job_failure_persist_failed",
            extra={"job_id": job_id, "run_id": run_id},
        )


def reset_job_for_retry(job_id, *, run_id=None):
    """Reset transient failures to a clean retryable state."""
    db.session.rollback()

    job = JobRepository().get(job_id)

    if job is None or job.status in {
        "SUCCESS", "CANCELLED", "PAUSED", "PAUSE_REQUESTED",
        "STOP_REQUESTED",
    }:
        return

    job.status = "QUEUED"
    job.progress = 0
    job.current_step = "QUEUED"
    job.finished_at = None
    job.error_code = None
    job.error_detail = None
    job.message = "Job dijadwalkan ulang setelah kegagalan sementara."

    if run_id is not None:
        run = RunRepository().get(run_id)

        if (
            run is not None
            and job.run_id == run.id
            and job.dataset_id == run.dataset_id
            and run.status in {"DRAFT", "CLUSTERING", "FAILED"}
        ):
            run.status = "DRAFT"
            run.is_active = False
            run.completed_at = None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception(
            "celery_job_retry_reset_failed",
            extra={"job_id": job_id, "run_id": run_id},
        )
