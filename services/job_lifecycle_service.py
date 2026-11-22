"""Safe lifecycle controls for Celery-backed processing jobs."""

from __future__ import annotations

from uuid import uuid4

from flask import current_app
from extensions import db
from models.job import ProcessingJob
from models.run import DBSCANRun
from repositories.experiment_repository import ExperimentRepository
from repositories.job_repository import JobRepository
from services.audit_service import AuditService
from services.exceptions import ConflictError, NotFoundError, ValidationError
from services.utils import EARTH_RADIUS_KM, utc_now


class JobLifecycleService:
    def __init__(self, jobs=None):
        self.jobs = jobs or JobRepository()

    @staticmethod
    def _audit(job, action, actor_id, details=None):
        AuditService().record(
            action=action,
            user_id=actor_id,
            entity_type="processing_job",
            entity_id=job.id,
            details={"job_type": job.job_type, **(details or {})},
            commit=False,
        )

    @staticmethod
    def _task_kwargs(job):
        payload = dict(job.input_payload or {})
        if job.job_type == "PARAMETER_SEARCH":
            return {
                "job_id": job.id,
                "dataset_id": job.dataset_id,
                "min_samples_candidates": payload["min_samples_candidates"],
                "sensitivity_percentages": payload.get("sensitivity_percentages"),
                "eps_candidates_km": payload.get("eps_candidates_km"),
                "use_default_grid": payload.get("use_default_grid"),
                "epsilon_default_grid_km": payload.get("epsilon_default_grid_km"),
                "epsilon_rounding_km": payload.get("epsilon_rounding_km"),
            }
        if job.job_type == "FINAL_CLUSTERING":
            if not job.run_id:
                raise ValidationError("Job Final DBSCAN tidak memiliki run_id.")
            return {
                "job_id": job.id,
                "run_id": job.run_id,
                "dataset_id": job.dataset_id,
                "experiment_id": payload["experiment_id"],
            }
        raise ValidationError("Jenis Job tidak didukung.")

    @staticmethod
    def _revoke(task_id):
        if not task_id:
            return
        try:
            current_app.extensions["celery"].control.revoke(
                task_id, terminate=False
            )
        except Exception:
            # PostgreSQL status remains authoritative; worker-side status guards
            # prevent a revoked-but-delivered task from doing work.
            current_app.logger.exception(
                "job_lifecycle_revoke_failed",
                extra={"task_id": task_id},
            )

    def _dispatch(self, job):
        celery = current_app.extensions["celery"]
        task_name = (
            "tasks.parameter_search"
            if job.job_type == "PARAMETER_SEARCH"
            else "tasks.final_clustering"
        )
        task_id = str(uuid4())
        job.celery_task_id = task_id
        db.session.commit()
        try:
            celery.tasks[task_name].apply_async(
                kwargs=self._task_kwargs(job),
                task_id=task_id,
            )
        except Exception as exc:
            db.session.rollback()
            failed = self.jobs.get(job.id)
            if failed is not None:
                failed.status = "FAILED"
                failed.finished_at = utc_now()
                failed.error_code = "TASK_DISPATCH_FAILED"
                failed.error_detail = str(exc)[:4000]
                failed.message = "Task lifecycle tidak dapat dikirim ke worker."
                db.session.commit()
            current_app.logger.exception(
                "job_lifecycle_dispatch_failed",
                extra={"job_id": job.id, "task_id": task_id},
            )
            raise ConflictError("Task tidak dapat dijadwalkan ke Celery.") from exc
        return job

    def _get(self, job_id):
        job = self.jobs.get_for_update(job_id)
        if job is not None:
            db.session.refresh(job, with_for_update=True)
        if job is None:
            raise NotFoundError("Processing job tidak ditemukan.")
        return job

    def pause(self, job_id, *, actor_id):
        job = self._get(job_id)
        if job.status in {"QUEUED", "RUNNING"} and not (job.input_payload or {}):
            raise ConflictError(
                "Job lama tidak memiliki input_payload; lifecycle pause/resume "
                "memerlukan konfigurasi eksekusi yang tersimpan."
            )
        if job.status == "QUEUED":
            previous_task_id = job.celery_task_id
            job.status = "PAUSED"
            job.paused_at = utc_now()
            job.checkpoint_data = {
                **(job.checkpoint_data or {}),
                "stage": "BEFORE_START",
                "progress": int(job.progress or 0),
            }
            job.message = "Job dijeda sebelum worker mulai."
            self._audit(job, "JOB_PAUSED", actor_id, {"mode": "queued"})
            db.session.commit()
            self._revoke(previous_task_id)
            return job
        if job.status == "RUNNING":
            job.status = "PAUSE_REQUESTED"
            job.pause_requested_at = utc_now()
            job.message = "Permintaan pause diterima; menunggu checkpoint aman."
            self._audit(job, "JOB_PAUSE_REQUESTED", actor_id)
            db.session.commit()
            return job
        if job.status in {"PAUSE_REQUESTED", "PAUSED"}:
            return job
        raise ConflictError(f"Job tidak dapat di-pause dari status {job.status}.")

    def resume(self, job_id, *, actor_id):
        job = self._get(job_id)
        if job.status != "PAUSED":
            raise ConflictError("Resume hanya dapat dilakukan pada Job berstatus PAUSED.")
        if not (job.input_payload or {}):
            raise ConflictError(
                "Job tidak memiliki input_payload; resume otomatis tidak aman."
            )
        job.status = "QUEUED"
        job.pause_requested_at = None
        job.paused_at = None
        job.stop_requested_at = None
        job.finished_at = None
        job.current_step = "QUEUED"
        job.error_code = None
        job.error_detail = None
        job.message = "Job dijadwalkan kembali dari checkpoint terakhir."
        self._audit(job, "JOB_RESUMED", actor_id, {"checkpoint": job.checkpoint_data or {}})
        db.session.commit()
        return self._dispatch(job)

    def stop(self, job_id, *, actor_id):
        job = self._get(job_id)
        if job.status in {"QUEUED", "PAUSED"}:
            previous_task_id = job.celery_task_id
            job.status = "CANCELLED"
            job.stop_requested_at = utc_now()
            job.finished_at = utc_now()
            job.current_step = "CANCELLED"
            job.message = "Job dihentikan oleh admin."
            self._audit(job, "JOB_CANCELLED", actor_id, {"mode": "immediate_safe"})
            db.session.commit()
            self._revoke(previous_task_id)
            return job
        if job.status in {"RUNNING", "PAUSE_REQUESTED"}:
            job.status = "STOP_REQUESTED"
            job.stop_requested_at = utc_now()
            job.message = "Permintaan stop diterima; menunggu checkpoint aman."
            self._audit(job, "JOB_STOP_REQUESTED", actor_id)
            db.session.commit()
            return job
        if job.status in {"STOP_REQUESTED", "CANCELLED"}:
            return job
        raise ConflictError(f"Job tidak dapat dihentikan dari status {job.status}.")

    def restart(self, job_id, *, actor_id):
        old = self._get(job_id)
        if old.status not in {"FAILED", "CANCELLED"}:
            raise ConflictError("Restart hanya tersedia untuk Job FAILED atau CANCELLED.")
        payload = dict(old.input_payload or {})
        if not payload:
            raise ConflictError(
                "Job lama tidak memiliki input_payload; restart otomatis tidak aman. "
                "Buat Job baru dengan parameter yang dikonfirmasi."
            )

        new_run = None
        if old.job_type == "FINAL_CLUSTERING":
            experiment_id = payload.get("experiment_id")
            experiment = ExperimentRepository().get_for_dataset(
                experiment_id, old.dataset_id
            )
            if experiment is None or not experiment.is_valid:
                raise ValidationError("Eksperimen asal tidak ditemukan atau tidak valid.")
            new_run = DBSCANRun(
                dataset_id=old.dataset_id,
                selected_experiment_id=experiment.id,
                eps_km=float(experiment.eps_km),
                eps_radian=float(experiment.eps_radian),
                min_samples=int(experiment.min_samples),
                metric="haversine",
                earth_radius_km=EARTH_RADIUS_KM,
                status="DRAFT",
                is_active=False,
                created_by=actor_id,
            )
            db.session.add(new_run)
            db.session.flush()

        new_job = ProcessingJob(
            dataset_id=old.dataset_id,
            run_id=new_run.id if new_run else None,
            job_type=old.job_type,
            parent_job_id=old.id,
            input_payload=payload,
            checkpoint_data={},
            celery_task_id=None,
            status="QUEUED",
            progress=0,
            current_step="QUEUED",
            message=f"Restart dari Job #{old.id}; menunggu worker Celery.",
            created_by=actor_id,
        )
        db.session.add(new_job)
        db.session.flush()
        self._audit(old, "JOB_RESTARTED", actor_id, {"new_job_id": new_job.id})
        self._audit(new_job, "JOB_CREATED_BY_RESTART", actor_id, {"parent_job_id": old.id})
        db.session.commit()
        try:
            self._dispatch(new_job)
        except ConflictError:
            raise
        return new_job
