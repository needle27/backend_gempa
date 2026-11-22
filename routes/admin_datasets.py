"""Admin dataset listing, clean CSV upload, and parameter-search dispatch."""

import csv
import math
from datetime import date
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from extensions import db
from models.job import ProcessingJob
from repositories.dataset_repository import DatasetRepository
from repositories.job_repository import JobRepository
from services.audit_service import AuditService
from services.dataset_service import DatasetService
from services.exceptions import ConflictError, ValidationError
from services.utils import finite_float, parse_aware_datetime, utc_now
from utils.admin_auth import admin_required
from utils.api_response import error, list_success, success
from utils.service_errors import service_error_response

admin_datasets_bp = Blueprint("admin_datasets", __name__, url_prefix="/api/admin/datasets")

REQUIRED_CSV_COLUMNS = (
    "event_id",
    "tanggal",
    "latitude",
    "longitude",
    "magnitude",
    "kedalaman",
    "lokasi",
)
STUDY_DATE_START = date(2021, 1, 1)
STUDY_DATE_END = date(2025, 12, 31)
STUDY_LAT_MIN, STUDY_LAT_MAX = -15.0, 10.0
STUDY_LON_MIN, STUDY_LON_MAX = 90.0, 145.0


def _validate_clean_csv(path):
    """Reject the whole upload on any invalid row; never silently drop or repair rows."""
    seen_ids = set()
    count = 0
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if not reader.fieldnames:
                raise ValidationError("CSV tidak memiliki header.")
            missing = [column for column in REQUIRED_CSV_COLUMNS if column not in reader.fieldnames]
            if missing:
                raise ValidationError("Kolom wajib tidak ditemukan: " + ", ".join(missing))

            for row_number, row in enumerate(reader, start=2):
                event_id = str(row.get("event_id") or "").strip()
                if not event_id:
                    raise ValidationError(f"Baris {row_number}: event_id wajib diisi.")
                if event_id in seen_ids:
                    raise ValidationError(f"Baris {row_number}: event_id duplikat ({event_id}).")
                seen_ids.add(event_id)

                timestamp = parse_aware_datetime(row.get("tanggal"), f"tanggal baris {row_number}")
                if not STUDY_DATE_START <= timestamp.date() <= STUDY_DATE_END:
                    raise ValidationError(
                        f"Baris {row_number}: tanggal harus berada pada periode 2021-01-01 sampai 2025-12-31."
                    )

                latitude = finite_float(row.get("latitude"), f"latitude baris {row_number}")
                longitude = finite_float(row.get("longitude"), f"longitude baris {row_number}")
                magnitude = finite_float(row.get("magnitude"), f"magnitude baris {row_number}")
                if not STUDY_LAT_MIN <= latitude <= STUDY_LAT_MAX:
                    raise ValidationError(
                        f"Baris {row_number}: latitude di luar batas penelitian "
                        f"{STUDY_LAT_MIN} sampai {STUDY_LAT_MAX}."
                    )
                if not STUDY_LON_MIN <= longitude <= STUDY_LON_MAX:
                    raise ValidationError(
                        f"Baris {row_number}: longitude di luar batas penelitian "
                        f"{STUDY_LON_MIN} sampai {STUDY_LON_MAX}."
                    )
                if magnitude < 0:
                    raise ValidationError(f"Baris {row_number}: magnitude tidak boleh negatif.")

                depth_raw = row.get("kedalaman")
                if depth_raw not in (None, ""):
                    depth = finite_float(depth_raw, f"kedalaman baris {row_number}")
                    if depth < 0:
                        raise ValidationError(f"Baris {row_number}: kedalaman tidak boleh negatif.")

                # lokasi bersifat metadata deskriptif; nilai kosong diperbolehkan.
                # DatasetService akan menyimpannya sebagai NULL tanpa menghapus baris.

                count += 1
    except UnicodeDecodeError as exc:
        raise ValidationError("CSV harus menggunakan encoding UTF-8 atau UTF-8-SIG.") from exc
    except ValidationError:
        raise
    except (ValueError, TypeError) as exc:
        raise ValidationError(str(exc)) from exc

    if count == 0:
        raise ValidationError("CSV tidak berisi baris data.")
    return count


@admin_datasets_bp.get("")
@jwt_required()
@admin_required
def list_datasets():
    try:
        page = max(int(request.args.get("page", 1)), 1)
        limit = min(max(int(request.args.get("limit", 20)), 1), 100)
    except ValueError:
        return error(message="page dan limit harus berupa integer.", code="VALIDATION_ERROR", status_code=422)

    filters = {}
    status = request.args.get("status")
    if status:
        filters["status"] = status.upper()

    datasets = DatasetRepository().list(
        page=page,
        per_page=limit,
        order_by="created_at",
        descending=True,
        **filters,
    )
    data = [
        {
            "id": item.id,
            "dataset_name": item.dataset_name,
            "source_name": item.source_name,
            "start_date": item.start_date.isoformat(),
            "end_date": item.end_date.isoformat(),
            "raw_row_count": item.raw_row_count,
            "cleaned_row_count": item.cleaned_row_count,
            "rejected_row_count": item.rejected_row_count,
            "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in datasets
    ]
    return list_success(data, count=len(data), limit=limit, offset=(page - 1) * limit)


@admin_datasets_bp.post("")
@jwt_required()
@admin_required
def upload_dataset():
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return error(message="File CSV wajib diunggah.", code="VALIDATION_ERROR", status_code=422)

    original_filename = secure_filename(uploaded.filename)
    if not original_filename or Path(original_filename).suffix.lower() != ".csv":
        return error(message="Hanya file .csv yang diperbolehkan.", code="UNSUPPORTED_FILE", status_code=415)

    dataset_name = str(request.form.get("dataset_name") or "").strip()
    source_name = str(request.form.get("source_name") or "").strip()
    if not dataset_name or not source_name:
        return error(
            message="dataset_name dan source_name wajib diisi.",
            code="VALIDATION_ERROR",
            status_code=422,
        )

    upload_dir = Path(current_app.config["UPLOAD_DIR"]).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    storage_path = upload_dir / f"{uuid4().hex}.csv"
    uploaded.save(storage_path)

    try:
        row_count = _validate_clean_csv(storage_path)
        dataset = DatasetService().import_clean_csv(
            file_path=storage_path,
            metadata={
                "dataset_name": dataset_name,
                "source_name": source_name,
                "source_url": request.form.get("source_url") or None,
                "original_filename": original_filename,
                "storage_path": str(storage_path),
                "preprocessing_version": request.form.get("preprocessing_version") or None,
            },
            uploaded_by=g.current_admin.id,
        )
        try:
            AuditService().record(
                action="DATASET_UPLOAD",
                user_id=g.current_admin.id,
                entity_type="dataset",
                entity_id=dataset.id,
                details={
                    "filename": original_filename,
                    "row_count": row_count,
                    "file_hash_sha256": dataset.file_hash_sha256,
                },
                ip_address=request.remote_addr,
                user_agent=request.headers.get("User-Agent"),
            )
        except Exception:
            # Dataset import is already committed; keep its source file and surface a log warning.
            current_app.logger.exception(
                "dataset_upload_audit_failed",
                extra={"dataset_id": dataset.id},
            )
        return success(
            {
                "dataset_id": dataset.id,
                "dataset_name": dataset.dataset_name,
                "status": dataset.status,
                "raw_row_count": dataset.raw_row_count,
                "cleaned_row_count": dataset.cleaned_row_count,
                "rejected_row_count": dataset.rejected_row_count,
                "date_range": {
                    "start": dataset.start_date.isoformat(),
                    "end": dataset.end_date.isoformat(),
                },
                "file_hash_sha256": dataset.file_hash_sha256,
            },
            status_code=201,
        )
    except (ValidationError, ConflictError) as exc:
        storage_path.unlink(missing_ok=True)
        return service_error_response(exc)
    except Exception:
        storage_path.unlink(missing_ok=True)
        current_app.logger.exception("dataset_upload_failed")
        db.session.rollback()
        return error(
            message="Upload dataset gagal diproses.",
            code="PROCESSING_ERROR",
            status_code=500,
        )


@admin_datasets_bp.post("/<int:dataset_id>/parameter-search")
@jwt_required()
@admin_required
def start_parameter_search(dataset_id):
    dataset = DatasetRepository().get(dataset_id)
    if dataset is None:
        return error(message="Dataset tidak ditemukan.", code="NOT_FOUND", status_code=404)
    if dataset.status not in {"READY", "PROCESSED"}:
        return error(message="Dataset belum berstatus READY.", code="DATASET_NOT_READY", status_code=409)

    payload = request.get_json(silent=True) or {}
    try:
        raw_min_samples = payload.get("min_samples_candidates", [])
        if not isinstance(raw_min_samples, list) or any(
            isinstance(value, bool) or int(value) != float(value) for value in raw_min_samples
        ):
            raise ValueError("min_samples_candidates harus berupa array integer.")
        min_samples = sorted({int(value) for value in raw_min_samples})
        raw_sensitivity = payload.get(
            "sensitivity_percentages", [-20, -10, 0, 10, 20]
        )
        if not isinstance(raw_sensitivity, list) or any(
            isinstance(value, bool) for value in raw_sensitivity
        ):
            raise ValueError("sensitivity_percentages harus berupa array angka.")
        sensitivity = [float(value) for value in raw_sensitivity]
        explicit_eps = payload.get("eps_candidates_km")
        use_default_grid = payload.get(
            "use_default_grid",
            current_app.config.get("EPSILON_USE_DEFAULT_GRID", True),
        )
        if not isinstance(use_default_grid, bool):
            raise ValueError("use_default_grid harus berupa boolean.")
        if explicit_eps is not None:
            if not isinstance(explicit_eps, list) or any(
                isinstance(value, bool) for value in explicit_eps
            ):
                raise ValueError("eps_candidates_km harus berupa array angka.")
            explicit_eps = sorted({float(value) for value in explicit_eps})
        if not min_samples or any(value < 2 for value in min_samples):
            raise ValueError("min_samples_candidates harus berisi integer minimal 2.")
        if not sensitivity or any(
            not math.isfinite(value) or not (-100 < value <= 500) for value in sensitivity
        ):
            raise ValueError("sensitivity_percentages harus finite, lebih besar dari -100, dan maksimal 500.")
        if explicit_eps is not None and (
            not explicit_eps
            or any(
                not math.isfinite(value) or value <= 0 or value > 1000.0
                for value in explicit_eps
            )
        ):
            raise ValueError(
                "eps_candidates_km harus berisi angka finite lebih besar dari 0 "
                "dan tidak melebihi 1.000 km."
            )
    except (TypeError, ValueError, OverflowError) as exc:
        return error(message=str(exc), code="VALIDATION_ERROR", status_code=422)

    active_jobs = [
        item
        for item in JobRepository().list_for_dataset(dataset_id, page=1, per_page=500)
        if item.job_type == "PARAMETER_SEARCH" and item.status in {
            "QUEUED", "RUNNING", "PAUSE_REQUESTED", "PAUSED",
            "STOP_REQUESTED", "RESTARTING",
        }
    ]
    if active_jobs:
        return error(
            message="Pencarian parameter untuk dataset ini masih berjalan.",
            code="JOB_ALREADY_RUNNING",
            details={"job_id": active_jobs[0].id},
            status_code=409,
        )

    # Freeze the effective server-side grid and rounding configuration in the
    # job input so pause/resume/restart remains reproducible if .env changes.
    default_grid_km = [
        float(value)
        for value in current_app.config.get(
            "EPSILON_DEFAULT_GRID_KM", [10, 15, 20, 25, 30, 40, 50, 60, 75, 100]
        )
    ]
    rounding_km = float(current_app.config.get("EPSILON_ROUNDING_KM", 0.5))

    task_id = str(uuid4())
    job = ProcessingJob(
        dataset_id=dataset_id,
        run_id=None,
        job_type="PARAMETER_SEARCH",
        celery_task_id=task_id,
        status="QUEUED",
        progress=0,
        current_step="QUEUED",
        message="Menunggu worker Celery.",
        created_by=g.current_admin.id,
        input_payload={
            "min_samples_candidates": min_samples,
            "sensitivity_percentages": sensitivity,
            "eps_candidates_km": explicit_eps,
            "use_default_grid": use_default_grid,
            "epsilon_default_grid_km": default_grid_km,
            "epsilon_rounding_km": rounding_km,
            "parameter_search_metadata": {
                "method_version": "4.1.4",
                "validity_thresholds": dict(
                    current_app.config.get(
                        "VALIDITY_THRESHOLDS",
                        {
                            "min_clusters": 2,
                            "max_clusters": 80,
                            "max_noise_percentage": 40.0,
                            "max_largest_cluster_ratio": 0.60,
                        },
                    )
                ),
                "default_grid": default_grid_km,
                "default_grid_km": default_grid_km if use_default_grid else [],
                "rounding_km": rounding_km,
                "epsilon_rounding_km": rounding_km,
                "use_default_grid": use_default_grid,
                "combination_mode": "cross",
                "epsilon_candidates_km": [],
                "candidate_status": "PENDING",
            },
        },
    )
    try:
        db.session.add(job)
        db.session.commit()
        task = current_app.extensions["celery"].tasks["tasks.parameter_search"]
        task.apply_async(
            kwargs={
                "job_id": job.id,
                "dataset_id": dataset_id,
                "min_samples_candidates": min_samples,
                "sensitivity_percentages": sensitivity,
                "eps_candidates_km": explicit_eps,
                "use_default_grid": use_default_grid,
                "epsilon_default_grid_km": default_grid_km,
                "epsilon_rounding_km": rounding_km,
            },
            task_id=task_id,
        )
        db.session.refresh(job)
        return success(
            {
                "job_id": job.id,
                "task_id": task_id,
                "status": job.status,
                "job_type": job.job_type,
            },
            status_code=202,
        )
    except Exception as exc:
        db.session.rollback()
        failed = JobRepository().get(job.id) if job.id else None
        if failed is not None:
            failed.status = "FAILED"
            failed.finished_at = utc_now()
            failed.error_code = "TASK_DISPATCH_FAILED"
            failed.error_detail = str(exc)[:4000]
            failed.message = "Task tidak dapat dikirim ke worker."
            db.session.commit()
        current_app.logger.exception("parameter_search_dispatch_failed")
        return error(
            message="Task pencarian parameter tidak dapat dijadwalkan.",
            code="PROCESSING_ERROR",
            status_code=503,
        )
