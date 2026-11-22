"""Admin final-run creation, run history, and global activation."""

from uuid import uuid4

from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from extensions import db
from models.job import ProcessingJob
from models.run import DBSCANRun
from repositories.dataset_repository import DatasetRepository
from repositories.experiment_repository import ExperimentRepository
from repositories.job_repository import JobRepository
from repositories.run_repository import RunRepository
from services.audit_service import AuditService
from services.dbscan_run_service import DBSCANRunService
from services.exceptions import ConflictError, NotFoundError
from services.utils import EARTH_RADIUS_KM, utc_now
from utils.admin_auth import admin_required
from utils.api_response import error, list_success, success
from utils.service_errors import service_error_response

admin_runs_bp = Blueprint("admin_runs", __name__, url_prefix="/api/admin")


def _serialize_run(run):
    return {
        "id": run.id,
        "dataset_id": run.dataset_id,
        "selected_experiment_id": run.selected_experiment_id,
        "eps_km": run.eps_km,
        "eps_radian": run.eps_radian,
        "min_samples": run.min_samples,
        "metric": run.metric,
        "cluster_count": run.cluster_count,
        "noise_count": run.noise_count,
        "noise_percentage": run.noise_percentage,
        "total_points": run.total_points,
        "silhouette_score": run.silhouette_score,
        "silhouette_sample_size": run.silhouette_sample_size,
        "dbi_score": run.dbi_score,
        "dbcv_score": run.dbcv_score,
        "evaluation_metadata": run.evaluation_metadata or {},
        "status": run.status,
        "is_active": run.is_active,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "activated_at": run.activated_at.isoformat() if run.activated_at else None,
    }


@admin_runs_bp.get("/datasets/<int:dataset_id>/runs")
@jwt_required()
@admin_required
def list_dataset_runs(dataset_id):
    if DatasetRepository().get(dataset_id) is None:
        return error(message="Dataset tidak ditemukan.", code="NOT_FOUND", status_code=404)
    runs = RunRepository().list_for_dataset(dataset_id, page=1, per_page=200)
    return list_success(
        [_serialize_run(run) for run in runs],
        count=len(runs),
        limit=200,
        offset=0,
    )


@admin_runs_bp.post("/datasets/<int:dataset_id>/runs")
@jwt_required()
@admin_required
def create_final_run(dataset_id):
    dataset = DatasetRepository().get(dataset_id)
    if dataset is None:
        return error(message="Dataset tidak ditemukan.", code="NOT_FOUND", status_code=404)
    if dataset.status not in {"READY", "PROCESSED"}:
        return error(message="Dataset belum berstatus READY.", code="DATASET_NOT_READY", status_code=409)

    payload = request.get_json(silent=True) or {}
    try:
        raw_experiment_id = payload.get("experiment_id")
        if isinstance(raw_experiment_id, bool):
            raise ValueError
        experiment_id = int(raw_experiment_id)
        if experiment_id < 1:
            raise ValueError
    except (TypeError, ValueError):
        return error(
            message="experiment_id wajib berupa bilangan bulat positif.",
            code="VALIDATION_ERROR",
            status_code=422,
        )

    experiment = ExperimentRepository().get_for_dataset(experiment_id, dataset_id)
    if experiment is None:
        return error(message="Eksperimen tidak ditemukan pada dataset tersebut.", code="EXPERIMENT_NOT_FOUND", status_code=404)
    if not experiment.is_valid:
        return error(message="Eksperimen tidak valid untuk final clustering.", code="RUN_NOT_READY", status_code=409)

    active_jobs = [
        item
        for item in JobRepository().list_for_dataset(dataset_id, page=1, per_page=500)
        if item.job_type == "FINAL_CLUSTERING" and item.status in {
            "QUEUED", "RUNNING", "PAUSE_REQUESTED", "PAUSED",
            "STOP_REQUESTED", "RESTARTING",
        }
    ]
    if active_jobs:
        return error(
            message="Final clustering untuk dataset ini masih berjalan.",
            code="JOB_ALREADY_RUNNING",
            details={"job_id": active_jobs[0].id},
            status_code=409,
        )

    task_id = str(uuid4())
    run = DBSCANRun(
        dataset_id=dataset_id,
        selected_experiment_id=experiment.id,
        eps_km=float(experiment.eps_km),
        eps_radian=float(experiment.eps_radian),
        min_samples=int(experiment.min_samples),
        metric="haversine",
        earth_radius_km=EARTH_RADIUS_KM,
        status="DRAFT",
        is_active=False,
        created_by=g.current_admin.id,
    )
    try:
        db.session.add(run)
        db.session.flush()

        job = ProcessingJob(
            dataset_id=dataset_id,
            run_id=run.id,
            job_type="FINAL_CLUSTERING",
            celery_task_id=task_id,
            status="QUEUED",
            progress=0,
            current_step="QUEUED",
            message="Menunggu worker Celery.",
            created_by=g.current_admin.id,
            input_payload={"experiment_id": experiment.id},
        )
        db.session.add(job)
        db.session.commit()

        task = current_app.extensions["celery"].tasks["tasks.final_clustering"]
        task.apply_async(
            kwargs={
                "job_id": job.id,
                "run_id": run.id,
                "dataset_id": dataset_id,
                "experiment_id": experiment.id,
            },
            task_id=task_id,
        )
        db.session.refresh(job)
        db.session.refresh(run)
        return success(
            {
                "job_id": job.id,
                "run_id": run.id,
                "task_id": task_id,
                "status": job.status,
            },
            status_code=202,
        )
    except Exception as exc:
        db.session.rollback()
        if "job" in locals() and job.id:
            failed_job = JobRepository().get(job.id)
            failed_run = RunRepository().get(run.id) if run.id else None
            if failed_job is not None:
                failed_job.status = "FAILED"
                failed_job.finished_at = utc_now()
                failed_job.error_code = "TASK_DISPATCH_FAILED"
                failed_job.error_detail = str(exc)[:4000]
                failed_job.message = "Task final clustering tidak dapat dijadwalkan."
            if failed_run is not None and failed_run.status != "SUCCESS":
                failed_run.status = "FAILED"
                failed_run.is_active = False
            db.session.commit()
        current_app.logger.exception("final_clustering_dispatch_failed")
        return error(
            message="Task final clustering tidak dapat dijadwalkan.",
            code="PROCESSING_ERROR",
            status_code=503,
        )


@admin_runs_bp.post("/runs/<int:run_id>/activate")
@jwt_required()
@admin_required
def activate_run(run_id):
    try:
        run = DBSCANRunService().activate_run(
            run_id=run_id,
            approved_by=g.current_admin.id,
        )
        AuditService().record(
            action="DBSCAN_RUN_ACTIVATED",
            user_id=g.current_admin.id,
            entity_type="dbscan_run",
            entity_id=run.id,
            details={"dataset_id": run.dataset_id},
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
        return success({"run": _serialize_run(run)})
    except (NotFoundError, ConflictError) as exc:
        return service_error_response(exc)
