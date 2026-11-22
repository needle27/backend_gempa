"""Admin read/validation endpoints missing from the earlier API snapshot.

All routes are admin-only. Dataset validation is a dry run: it does not create
or modify dataset/database records and uses the same CSV validator as upload.
"""
from __future__ import annotations

import hashlib
import tempfile
from pathlib import Path

from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required
from sqlalchemy import select
from werkzeug.utils import secure_filename

from extensions import db
from models.dataset import DatasetInfo
from models.experiment import DBSCANParameterExperiment
from models.job import ProcessingJob
from models.run import DBSCANRun
from repositories.audit_log_repository import AuditLogRepository
from repositories.dataset_repository import DatasetRepository
from repositories.experiment_repository import ExperimentRepository
from repositories.run_repository import RunRepository
from routes.admin_datasets import REQUIRED_CSV_COLUMNS, _validate_clean_csv
from routes.admin_jobs import serialize_experiment
from services.audit_service import AuditService
from services.exceptions import ValidationError
from services.utils import parse_aware_datetime
from utils.admin_auth import admin_required
from utils.api_response import error, list_success, success

admin_support_bp = Blueprint("admin_support", __name__, url_prefix="/api/admin")


def _safe_audit(*, action, entity_type, entity_id=None, details=None):
    """Audit failures must not turn a successful read/validation into a 500."""
    try:
        AuditService().record(
            action=action,
            user_id=g.current_admin.id,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except Exception:
        current_app.logger.exception("admin_support_audit_write_failed")


def _serialize_dataset(dataset: DatasetInfo) -> dict:
    return {
        "id": dataset.id,
        "dataset_name": dataset.dataset_name,
        "source_name": dataset.source_name,
        "source_url": dataset.source_url,
        "original_filename": dataset.original_filename,
        "file_hash_sha256": dataset.file_hash_sha256,
        "start_date": dataset.start_date.isoformat() if dataset.start_date else None,
        "end_date": dataset.end_date.isoformat() if dataset.end_date else None,
        "spatial_bounds": {
            "latitude_min": dataset.latitude_min,
            "latitude_max": dataset.latitude_max,
            "longitude_min": dataset.longitude_min,
            "longitude_max": dataset.longitude_max,
        },
        "raw_row_count": dataset.raw_row_count,
        "cleaned_row_count": dataset.cleaned_row_count,
        "rejected_row_count": dataset.rejected_row_count,
        "preprocessing_version": dataset.preprocessing_version,
        "validation_report": dataset.validation_report or {},
        "status": dataset.status,
        "uploaded_by": dataset.uploaded_by,
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
        "updated_at": dataset.updated_at.isoformat() if dataset.updated_at else None,
    }


def _serialize_experiment(experiment: DBSCANParameterExperiment | None):
    if experiment is None:
        return None
    return serialize_experiment(experiment)


def _serialize_run(run: DBSCANRun) -> dict:
    return {
        "id": run.id,
        "dataset_id": run.dataset_id,
        "selected_experiment_id": run.selected_experiment_id,
        "eps_km": run.eps_km,
        "eps_radian": run.eps_radian,
        "min_samples": run.min_samples,
        "metric": run.metric,
        "earth_radius_km": run.earth_radius_km,
        "cluster_count": run.cluster_count,
        "noise_count": run.noise_count,
        "noise_percentage": run.noise_percentage,
        "total_points": run.total_points,
        "silhouette_score": run.silhouette_score,
        "silhouette_sample_size": run.silhouette_sample_size,
        "dbcv_score": run.dbcv_score,
        "dbi_score": run.dbi_score,
        "evaluation_metadata": run.evaluation_metadata or {},
        "status": run.status,
        "is_active": run.is_active,
        "created_by": run.created_by,
        "approved_by": run.approved_by,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "activated_at": run.activated_at.isoformat() if run.activated_at else None,
    }


@admin_support_bp.post("/datasets/validate")
@jwt_required()
@admin_required
def validate_dataset_upload():
    """Validate a clean CSV without importing it or writing a dataset record."""
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return error(
            message="File CSV wajib diunggah pada field 'file'.",
            code="VALIDATION_ERROR",
            details={"valid": False},
            status_code=422,
        )

    filename = secure_filename(uploaded.filename)
    if not filename or Path(filename).suffix.lower() != ".csv":
        return error(
            message="Hanya file .csv yang diperbolehkan.",
            code="UNSUPPORTED_FILE",
            details={"valid": False},
            status_code=415,
        )

    try:
        with tempfile.TemporaryDirectory(prefix="dataset-validation-") as temp_dir:
            file_path = Path(temp_dir) / filename
            uploaded.save(file_path)
            row_count = _validate_clean_csv(file_path)
            digest = hashlib.sha256(file_path.read_bytes()).hexdigest()
            duplicate = DatasetRepository().get_by_hash(digest)
            if duplicate is not None:
                _safe_audit(
                    action="DATASET_VALIDATE",
                    entity_type="dataset_file",
                    entity_id=duplicate.id,
                    details={"filename": filename, "valid": False, "reason": "duplicate_hash"},
                )
                return error(
                    message="File dengan SHA-256 yang sama sudah terdaftar.",
                    code="DUPLICATE_DATASET_FILE",
                    details={"valid": False, "existing_dataset_id": duplicate.id},
                    status_code=409,
                )

        _safe_audit(
            action="DATASET_VALIDATE",
            entity_type="dataset_file",
            details={"filename": filename, "valid": True, "row_count": row_count, "file_hash_sha256": digest},
        )
        return success(
            {
                "valid": True,
                "persisted": False,
                "filename": filename,
                "file_hash_sha256": digest,
                "row_count": row_count,
                "required_columns": list(REQUIRED_CSV_COLUMNS),
                "rules": {
                    "date_start": "2021-01-01",
                    "date_end": "2025-12-31",
                    "timestamp_timezone": "ISO-8601 dengan timezone/offset wajib; tidak ditebak",
                    "latitude_min": -15.0,
                    "latitude_max": 10.0,
                    "longitude_min": 90.0,
                    "longitude_max": 145.0,
                    "magnitude": "finite numeric dan >= 0",
                    "depth_km": "boleh kosong; jika diisi harus finite numeric dan >= 0",
                    "event_id": "wajib dan unik dalam file",
                    "lokasi": "opsional; nilai kosong disimpan sebagai NULL saat upload",
                },
            }
        )
    except ValidationError as exc:
        _safe_audit(
            action="DATASET_VALIDATE",
            entity_type="dataset_file",
            details={"filename": filename, "valid": False, "reason": str(exc)[:300]},
        )
        return error(
            message=str(exc),
            code="VALIDATION_ERROR",
            details={"valid": False},
            status_code=422,
        )
    except Exception:
        current_app.logger.exception("dataset_dry_run_validation_failed")
        return error(
            message="Validasi dataset gagal diproses.",
            code="PROCESSING_ERROR",
            status_code=500,
        )


@admin_support_bp.get("/datasets/<int:dataset_id>")
@jwt_required()
@admin_required
def get_dataset_detail(dataset_id: int):
    dataset = DatasetRepository().get(dataset_id)
    if dataset is None:
        return error(message="Dataset tidak ditemukan.", code="NOT_FOUND", status_code=404)
    return success(_serialize_dataset(dataset))


@admin_support_bp.get("/runs/<int:run_id>")
@jwt_required()
@admin_required
def get_run_detail(run_id: int):
    run = RunRepository().get(run_id)
    if run is None:
        return error(message="Run tidak ditemukan.", code="NOT_FOUND", status_code=404)

    experiment = ExperimentRepository().get_for_dataset(
        run.selected_experiment_id, run.dataset_id
    )
    job = db.session.scalar(
        select(ProcessingJob)
        .where(ProcessingJob.run_id == run.id)
        .order_by(ProcessingJob.created_at.desc(), ProcessingJob.id.desc())
        .limit(1)
    )
    job_data = None
    if job is not None:
        job_data = {
            "id": job.id,
            "status": job.status,
            "progress": job.progress,
            "current_step": job.current_step,
            "message": job.message,
            "error_code": job.error_code,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        }

    return success(
        {
            "run": _serialize_run(run),
            "selected_experiment": _serialize_experiment(experiment),
            "job": job_data,
        }
    )


@admin_support_bp.get("/audit-logs")
@jwt_required()
@admin_required
def list_audit_logs():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
        if page < 1 or not 1 <= limit <= 200:
            raise ValueError("page minimal 1 dan limit harus berada pada rentang 1-200.")

        entity_id = request.args.get("entity_id")
        user_id = request.args.get("user_id")
        entity_id = int(entity_id) if entity_id not in (None, "") else None
        user_id = int(user_id) if user_id not in (None, "") else None
        if entity_id is not None and entity_id < 1:
            raise ValueError("entity_id harus integer positif.")
        if user_id is not None and user_id < 1:
            raise ValueError("user_id harus integer positif.")

        created_after_raw = request.args.get("created_after")
        created_before_raw = request.args.get("created_before")
        created_after = (
            parse_aware_datetime(created_after_raw, "created_after")
            if created_after_raw else None
        )
        created_before = (
            parse_aware_datetime(created_before_raw, "created_before")
            if created_before_raw else None
        )
        if created_after and created_before and created_after > created_before:
            raise ValueError("created_after tidak boleh lebih besar dari created_before.")
    except (TypeError, ValueError) as exc:
        return error(message=str(exc), code="VALIDATION_ERROR", status_code=422)

    filters = {
        "action": request.args.get("action", "").strip() or None,
        "entity_type": request.args.get("entity_type", "").strip() or None,
        "entity_id": entity_id,
        "user_id": user_id,
        "created_after": created_after,
        "created_before": created_before,
        "query": request.args.get("q", "").strip() or None,
    }
    if filters["action"] and len(filters["action"]) > 100:
        return error(message="action maksimal 100 karakter.", code="VALIDATION_ERROR", status_code=422)
    if filters["entity_type"] and len(filters["entity_type"]) > 50:
        return error(message="entity_type maksimal 50 karakter.", code="VALIDATION_ERROR", status_code=422)
    if filters["query"] and len(filters["query"]) > 120:
        return error(message="q maksimal 120 karakter.", code="VALIDATION_ERROR", status_code=422)

    rows, total = AuditLogRepository().list_filtered(
        page=page,
        per_page=limit,
        **filters,
    )
    data = [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user": (
                {"username": username, "email": email}
                if log.user_id is not None else None
            ),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details or {},
            "ip_address": str(log.ip_address) if log.ip_address else None,
            "user_agent": log.user_agent,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log, username, email in rows
    ]
    return list_success(
        data,
        count=total,
        limit=limit,
        offset=(page - 1) * limit,
    )
