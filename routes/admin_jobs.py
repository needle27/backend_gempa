"""Admin job status and experiment-result endpoints."""

import json
from pathlib import Path

from flask import Blueprint, current_app, g, request, send_file
from flask_jwt_extended import jwt_required

from repositories.experiment_repository import ExperimentRepository
from repositories.artifact_repository import ArtifactRepository
from repositories.job_repository import JobRepository
from services.job_lifecycle_service import JobLifecycleService
from services.exceptions import ConflictError, NotFoundError, ValidationError
from utils.admin_auth import admin_required
from utils.api_response import error, success, list_success

admin_jobs_bp = Blueprint("admin_jobs", __name__, url_prefix="/api/admin/jobs")


@admin_jobs_bp.get("")
@jwt_required()
@admin_required
def list_jobs():
    """List processing jobs with pagination and optional filters."""
    from flask import request

    try:
        page_raw = request.args.get("page", "1")
        limit_raw = request.args.get("limit", "20")
        if not page_raw.isdigit() or not limit_raw.isdigit():
            raise ValueError
        page = int(page_raw)
        limit = int(limit_raw)
        if page < 1:
            return error(
                message="page harus berupa integer minimal 1.",
                code="VALIDATION_ERROR",
                status_code=422,
            )
        if not 1 <= limit <= 100:
            return error(
                message="limit harus berupa integer antara 1 dan 100.",
                code="VALIDATION_ERROR",
                status_code=422,
            )
    except (TypeError, ValueError):
        return error(
            message="page dan limit harus berupa integer.",
            code="VALIDATION_ERROR",
            status_code=422,
        )

    status_filter = request.args.get("status")
    if status_filter:
        status_filter = status_filter.strip().upper()
        allowed_statuses = {
            "QUEUED", "RUNNING", "PAUSE_REQUESTED", "PAUSED",
            "STOP_REQUESTED", "RESTARTING", "SUCCESS", "FAILED", "CANCELLED",
        }
        if status_filter not in allowed_statuses:
            return error(
                message="status tidak valid.",
                code="VALIDATION_ERROR",
                details={"allowed": sorted(allowed_statuses)},
                status_code=422,
            )

    job_type_filter = request.args.get("job_type")
    if job_type_filter:
        job_type_filter = job_type_filter.strip().upper()
        allowed_job_types = {"PARAMETER_SEARCH", "FINAL_CLUSTERING"}
        if job_type_filter not in allowed_job_types:
            return error(
                message="job_type tidak valid.",
                code="VALIDATION_ERROR",
                details={"allowed": sorted(allowed_job_types)},
                status_code=422,
            )

    dataset_id_filter = request.args.get("dataset_id")
    if dataset_id_filter is not None:
        if not dataset_id_filter.isdigit() or int(dataset_id_filter) < 1:
            return error(
                message="dataset_id harus berupa integer positif.",
                code="VALIDATION_ERROR",
                status_code=422,
            )
        dataset_id_filter = int(dataset_id_filter)

    jobs, total = JobRepository().list_jobs(
        page=page,
        per_page=limit,
        status=status_filter,
        job_type=job_type_filter,
        dataset_id=dataset_id_filter,
    )
    data = [
        {
            "id": job.id,
            "dataset_id": job.dataset_id,
            "run_id": job.run_id,
            "parent_job_id": job.parent_job_id,
            "celery_task_id": job.celery_task_id,
            "job_type": job.job_type,
            "status": job.status,
            "progress": job.progress,
            "current_step": job.current_step,
            "message": job.message,
            "checkpoint_data": job.checkpoint_data or {},
            "pause_requested_at": job.pause_requested_at.isoformat() if job.pause_requested_at else None,
            "paused_at": job.paused_at.isoformat() if job.paused_at else None,
            "stop_requested_at": job.stop_requested_at.isoformat() if job.stop_requested_at else None,
            "error_code": job.error_code,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        }
        for job in jobs
    ]
    return list_success(
        data,
        count=total,
        limit=limit,
        offset=(page - 1) * limit,
    )


def _elbow_artifacts(job_id):
    return [
        item for item in ArtifactRepository().list_for_job(job_id)
        if (item.artifact_metadata or {}).get("analysis") == "elbow"
    ]


def _build_knee_summary(job):
    if job is None or getattr(job, "job_type", None) != "PARAMETER_SEARCH":
        return None

    payload = getattr(job, "input_payload", {}) or {}
    meta = payload.get("parameter_search_metadata") or {}
    if meta.get("knee_summary"):
        return meta["knee_summary"]

    # Fallback dari artefak elbow jika ada
    artifacts = _elbow_artifacts(job.id)
    metadata_rows = [
        item for item in artifacts
        if (item.artifact_metadata or {}).get("kind") == "curve_metadata"
    ]
    if not metadata_rows:
        return None

    curves = []
    for item in metadata_rows:
        m = item.artifact_metadata or {}
        min_samples = m.get("min_samples")
        if min_samples is None:
            continue
        kd = m.get("knee_detection") or {}
        percentiles = m.get("k_distance_percentiles_km") or {}
        knee_eps = m.get("eps_knee_km", kd.get("eps_knee_km", m.get("epsilon_km")))
        detected = bool(m.get("knee_detected", kd.get("detected", knee_eps is not None)))
        curves.append({
            "min_samples": int(min_samples),
            "knee_eps_km": float(knee_eps) if knee_eps is not None else None,
            "p90_km": float(percentiles["p90"]) if "p90" in percentiles and percentiles["p90"] is not None else None,
            "p95_km": float(percentiles["p95"]) if "p95" in percentiles and percentiles["p95"] is not None else None,
            "p98_km": float(percentiles["p98"]) if "p98" in percentiles and percentiles["p98"] is not None else None,
            "detected": detected,
            "status": "DETECTED" if detected else "NOT_DETECTED",
        })
    curves.sort(key=lambda x: int(x["min_samples"]))
    return curves if curves else None


def _normalize_search_metadata(raw_meta):
    if not isinstance(raw_meta, dict):
        return None

    meta = dict(raw_meta)

    # 1. default_grid vs default_grid_km (kanonik: default_grid_km)
    dg = meta.get("default_grid_km")
    if dg is None:
        dg = meta.get("default_grid")
    if dg is not None:
        meta["default_grid_km"] = dg
        meta["default_grid"] = dg

    # 2. rounding_km vs epsilon_rounding_km (kanonik: epsilon_rounding_km)
    rk = meta.get("epsilon_rounding_km")
    if rk is None:
        rk = meta.get("rounding_km")
    if rk is not None:
        meta["epsilon_rounding_km"] = rk
        meta["rounding_km"] = rk

    # 3. knee_not_found vs knee_not_detected_min_samples (kanonik: knee_not_detected_min_samples)
    knf = meta.get("knee_not_detected_min_samples")
    if knf is None:
        knf = meta.get("knee_not_found")
    if knf is not None:
        meta["knee_not_detected_min_samples"] = knf
        meta["knee_not_found"] = knf

    return meta


def serialize_experiment(item):
    if item is None:
        return None

    meta = getattr(item, "evaluation_metadata", None)
    if not isinstance(meta, dict):
        meta = {}

    max_c = getattr(item, "max_cluster_size", None)
    clustered = getattr(item, "clustered_count", None)

    # largest_cluster_ratio: float | None
    lcr = getattr(item, "largest_cluster_ratio", None)
    if lcr is None:
        lcr = meta.get("largest_cluster_ratio")
    if lcr is None and max_c is not None and clustered and clustered > 0:
        lcr = float(max_c) / float(clustered)
    largest_cluster_ratio = float(lcr) if lcr is not None else None

    # invalid_reasons: list[str] | None ([] untuk valid T6+, list untuk invalid T6+, None untuk pra-T6)
    invalid_reasons = meta.get("invalid_reasons")
    if invalid_reasons is not None and not isinstance(invalid_reasons, list):
        invalid_reasons = list(invalid_reasons)

    # stability_score: float | None
    stab = getattr(item, "stability_score", None)
    if stab is None:
        stab = meta.get("stability_score")
    stability_score = float(stab) if stab is not None else None

    # recommendation_score: float | None
    rec_score = getattr(item, "recommendation_score", None)
    if rec_score is None:
        rec_score = meta.get("recommendation_score")
    if rec_score is None:
        rec_obj = meta.get("recommendation")
        if isinstance(rec_obj, dict):
            rec_score = rec_obj.get("score")
    recommendation_score = float(rec_score) if rec_score is not None else None

    # eps_sources: list[str] | None
    eps_sources = None
    param_meta = meta.get("parameter_search")
    if isinstance(param_meta, dict) and "eps_sources" in param_meta:
        eps_sources = list(param_meta["eps_sources"])
    elif "eps_sources" in meta and meta["eps_sources"] is not None:
        eps_sources = list(meta["eps_sources"])

    return {
        "id": getattr(item, "id", None),
        "dataset_id": getattr(item, "dataset_id", None),
        "job_id": getattr(item, "job_id", None),
        "eps_km": getattr(item, "eps_km", None),
        "eps_radian": getattr(item, "eps_radian", None),
        "min_samples": getattr(item, "min_samples", None),
        "cluster_count": getattr(item, "cluster_count", None),
        "noise_count": getattr(item, "noise_count", None),
        "noise_percentage": getattr(item, "noise_percentage", None),
        "clustered_count": getattr(item, "clustered_count", None),
        "min_cluster_size": getattr(item, "min_cluster_size", None),
        "median_cluster_size": getattr(item, "median_cluster_size", None),
        "max_cluster_size": max_c,
        "silhouette_score": getattr(item, "silhouette_score", None),
        "silhouette_sample_size": getattr(item, "silhouette_sample_size", None),
        "dbi_score": getattr(item, "dbi_score", None),
        "dbcv_score": getattr(item, "dbcv_score", None),
        "evaluation_metadata": meta,
        "is_valid": getattr(item, "is_valid", None),
        "invalid_reason": getattr(item, "invalid_reason", None),
        "is_recommended": getattr(item, "is_recommended", False),
        # Field additive T9:
        "largest_cluster_ratio": largest_cluster_ratio,
        "invalid_reasons": invalid_reasons,
        "stability_score": stability_score,
        "recommendation_score": recommendation_score,
        "eps_sources": eps_sources,
    }


@admin_jobs_bp.get("/<int:job_id>")
@jwt_required()
@admin_required
def get_job(job_id):
    job = JobRepository().get(job_id)
    if job is None:
        return error(message="Job tidak ditemukan.", code="NOT_FOUND", status_code=404)

    payload = job.input_payload or {}
    raw_search_meta = payload.get("parameter_search_metadata")
    search_meta = _normalize_search_metadata(raw_search_meta)

    knee_summary = _build_knee_summary(job)

    validity_thresholds = None
    if search_meta and "validity_thresholds" in search_meta:
        validity_thresholds = search_meta["validity_thresholds"]

    recommendation_status = None
    recommendation_weights = None
    selected_experiment = None

    if search_meta:
        rec_obj = search_meta.get("recommendation") or {}
        recommendation_status = (
            search_meta.get("recommendation_status")
            or rec_obj.get("status")
            or payload.get("recommendation_status")
        )
        recommendation_weights = (
            search_meta.get("recommendation_weights")
            or rec_obj.get("recommendation_weights")
            or payload.get("recommendation_weights")
        )
        selected_experiment = (
            search_meta.get("selected_experiment")
            or rec_obj.get("selected_experiment")
            or payload.get("selected_experiment")
        )

    return success(
        {
            "id": job.id,
            "dataset_id": job.dataset_id,
            "run_id": job.run_id,
            "parent_job_id": job.parent_job_id,
            "celery_task_id": job.celery_task_id,
            "job_type": job.job_type,
            "status": job.status,
            "progress": job.progress,
            "current_step": job.current_step,
            "message": job.message,
            "checkpoint_data": job.checkpoint_data or {},
            "parameter_search_metadata": search_meta,
            "pause_requested_at": job.pause_requested_at.isoformat() if job.pause_requested_at else None,
            "paused_at": job.paused_at.isoformat() if job.paused_at else None,
            "stop_requested_at": job.stop_requested_at.isoformat() if job.stop_requested_at else None,
            "error_code": job.error_code,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            # Field additive T9:
            "knee_summary": knee_summary,
            "validity_thresholds": validity_thresholds,
            "recommendation_status": recommendation_status,
            "recommendation_weights": recommendation_weights,
            "selected_experiment": selected_experiment,
        }
    )



def _lifecycle_action(job_id, action):
    service = JobLifecycleService()
    try:
        job = getattr(service, action)(job_id, actor_id=g.current_admin.id)
        return success({
            "id": job.id,
            "parent_job_id": job.parent_job_id,
            "dataset_id": job.dataset_id,
            "run_id": job.run_id,
            "job_type": job.job_type,
            "status": job.status,
            "progress": job.progress,
            "current_step": job.current_step,
            "message": job.message,
            "celery_task_id": job.celery_task_id,
            "checkpoint_data": job.checkpoint_data or {},
        }, status_code=202 if action in {"resume", "restart"} else 200)
    except NotFoundError as exc:
        return error(message=str(exc), code="NOT_FOUND", status_code=404)
    except (ConflictError, ValidationError) as exc:
        return error(message=str(exc), code="JOB_LIFECYCLE_CONFLICT", status_code=409)
    except Exception:
        current_app.logger.exception(
            "job_lifecycle_action_failed",
            extra={"job_id": job_id, "action": action},
        )
        return error(
            message="Operasi lifecycle Job gagal diproses.",
            code="JOB_LIFECYCLE_FAILED",
            status_code=500,
        )


@admin_jobs_bp.post("/<int:job_id>/pause")
@jwt_required()
@admin_required
def pause_job(job_id):
    """Request a cooperative pause; RUNNING jobs pause at a safe checkpoint."""
    return _lifecycle_action(job_id, "pause")


@admin_jobs_bp.post("/<int:job_id>/resume")
@jwt_required()
@admin_required
def resume_job(job_id):
    """Resume a PAUSED job by dispatching a new Celery delivery for the same Job."""
    return _lifecycle_action(job_id, "resume")


@admin_jobs_bp.post("/<int:job_id>/stop")
@jwt_required()
@admin_required
def stop_job(job_id):
    """Request cooperative cancellation at the next safe checkpoint."""
    return _lifecycle_action(job_id, "stop")


@admin_jobs_bp.post("/<int:job_id>/restart")
@jwt_required()
@admin_required
def restart_job(job_id):
    """Create a new Job linked to its predecessor; never mutate the old Job."""
    return _lifecycle_action(job_id, "restart")


@admin_jobs_bp.get("/<int:job_id>/experiments")
@jwt_required()
@admin_required
def get_job_experiments(job_id):
    job = JobRepository().get(job_id)
    if job is None:
        return error(message="Job tidak ditemukan.", code="NOT_FOUND", status_code=404)

    experiments = ExperimentRepository().list_for_job(job_id)
    data = [serialize_experiment(item) for item in experiments]
    return list_success(data, count=len(data), limit=len(data), offset=0)


def _artifact_download_path(artifact):
    root = Path(current_app.config["ARTIFACT_DIR"]).expanduser().resolve()
    path = Path(artifact.storage_path).expanduser().resolve()
    if not path.is_relative_to(root) or not path.is_file():
        return None
    return path


@admin_jobs_bp.get("/<int:job_id>/elbow")
@jwt_required()
@admin_required
def get_job_elbow_summary(job_id):
    job = JobRepository().get(job_id)
    if job is None:
        return error(message="Job tidak ditemukan.", code="NOT_FOUND", status_code=404)
    if job.job_type != "PARAMETER_SEARCH":
        return error(
            message="Elbow Analysis hanya tersedia untuk job PARAMETER_SEARCH.",
            code="INVALID_JOB_TYPE", status_code=409,
        )

    artifacts = _elbow_artifacts(job_id)
    metadata_rows = [
        item for item in artifacts
        if (item.artifact_metadata or {}).get("kind") == "curve_metadata"
    ]
    curves = []
    for item in metadata_rows:
        metadata = item.artifact_metadata or {}
        min_samples = metadata.get("min_samples")
        if min_samples is None:
            continue
        curves.append({
            "min_samples": min_samples,
            "point_count": metadata.get("point_count"),
            "knee_detected": metadata.get(
                "knee_detected",
                (metadata.get("knee_detection") or {}).get("detected", False),
            ),
            "epsilon_km": metadata.get(
                "epsilon_km",
                (metadata.get("knee_detection") or {}).get("epsilon_km"),
            ),
            "detail_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}",
            "plot_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=plot",
            "data_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=data",
            "metadata_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=metadata",
        })
    curves.sort(key=lambda item: int(item["min_samples"]))
    comparison = next(
        (item for item in artifacts
         if (item.artifact_metadata or {}).get("kind") == "comparison_plot"),
        None,
    )
    return success({
        "job_id": job.id,
        "dataset_id": job.dataset_id,
        "job_status": job.status,
        "ready": bool(curves),
        "metric": "haversine",
        "distance_unit": "km",
        "curves": curves,
        "comparison_plot_url": (
            f"/api/admin/jobs/{job_id}/elbow/comparison/artifact"
            if comparison is not None else None
        ),
    })


@admin_jobs_bp.get("/<int:job_id>/elbow/<int:min_samples>")
@jwt_required()
@admin_required
def get_job_elbow_detail(job_id, min_samples):
    job = JobRepository().get(job_id)
    if job is None:
        return error(message="Job tidak ditemukan.", code="NOT_FOUND", status_code=404)
    if job.job_type != "PARAMETER_SEARCH":
        return error(message="Jenis job tidak mendukung Elbow.", code="INVALID_JOB_TYPE", status_code=409)
    metadata_artifact = next(
        (item for item in _elbow_artifacts(job_id)
         if (item.artifact_metadata or {}).get("kind") == "curve_metadata"
         and int((item.artifact_metadata or {}).get("min_samples", -1)) == min_samples),
        None,
    )
    if metadata_artifact is None:
        return error(message="Artefak Elbow untuk MinPts tersebut tidak ditemukan.", code="NOT_FOUND", status_code=404)
    metadata_path = _artifact_download_path(metadata_artifact)
    if metadata_path is None:
        return error(message="File metadata Elbow tidak ditemukan.", code="ARTIFACT_NOT_FOUND", status_code=404)
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return error(message="Metadata Elbow tidak dapat dibaca.", code="ARTIFACT_READ_FAILED", status_code=500)
    metadata["files"] = {
        "plot_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=plot",
        "data_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=data",
        "metadata_url": f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=metadata",
    }
    return success(metadata)


@admin_jobs_bp.get("/<int:job_id>/elbow/comparison/artifact")
@jwt_required()
@admin_required
def download_job_elbow_comparison(job_id):
    job = JobRepository().get(job_id)
    if job is None:
        return error(message="Job tidak ditemukan.", code="NOT_FOUND", status_code=404)
    artifact = next(
        (item for item in _elbow_artifacts(job_id)
         if (item.artifact_metadata or {}).get("kind") == "comparison_plot"),
        None,
    )
    if artifact is None:
        return error(message="Grafik perbandingan belum tersedia.", code="NOT_FOUND", status_code=404)
    path = _artifact_download_path(artifact)
    if path is None:
        return error(message="File artefak tidak ditemukan.", code="ARTIFACT_NOT_FOUND", status_code=404)
    return send_file(path, mimetype=artifact.mime_type, as_attachment=True, download_name=artifact.filename)


@admin_jobs_bp.get("/<int:job_id>/elbow/<int:min_samples>/artifact")
@jwt_required()
@admin_required
def download_job_elbow_artifact(job_id, min_samples):
    job = JobRepository().get(job_id)
    if job is None:
        return error(message="Job tidak ditemukan.", code="NOT_FOUND", status_code=404)
    kind = request.args.get("kind", "plot").strip().lower()
    kind_map = {
        "plot": "curve_plot",
        "data": "curve_data",
        "metadata": "curve_metadata",
    }
    if kind not in kind_map:
        return error(
            message="kind harus plot, data, atau metadata.",
            code="VALIDATION_ERROR", status_code=422,
        )
    artifact = next(
        (item for item in _elbow_artifacts(job_id)
         if (item.artifact_metadata or {}).get("kind") == kind_map[kind]
         and int((item.artifact_metadata or {}).get("min_samples", -1)) == min_samples),
        None,
    )
    if artifact is None:
        return error(message="Artefak Elbow tidak ditemukan.", code="NOT_FOUND", status_code=404)
    path = _artifact_download_path(artifact)
    if path is None:
        return error(message="File artefak tidak ditemukan.", code="ARTIFACT_NOT_FOUND", status_code=404)
    return send_file(path, mimetype=artifact.mime_type, as_attachment=True, download_name=artifact.filename)
