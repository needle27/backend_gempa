"""Celery task for Haversine KNN/k-distance and DBSCAN parameter experiments."""

from celery.exceptions import Retry
from flask import current_app
from redis.exceptions import RedisError
from extensions import db
from sqlalchemy.exc import OperationalError

from repositories.job_repository import JobRepository
from services.exceptions import (
    ConflictError, NotFoundError, ValidationError, ProcessingError,
)
from services.parameter_search_service import ParameterSearchService
from services.elbow_artifact_service import ElbowArtifactService
from repositories.dataset_repository import DatasetRepository
from tasks.task_utils import (
    dataset_job_lock, job_checkpoint, mark_job_failed, mark_job_running,
    reset_job_for_retry,
)
from services.exceptions import JobPaused, JobCancelled


def register_parameter_search_task(celery):
    @celery.task(bind=True, name="tasks.parameter_search", max_retries=3)
    def run_parameter_search(
        self,
        *,
        job_id,
        dataset_id,
        min_samples_candidates,
        sensitivity_percentages=None,
        eps_candidates_km=None,
        use_default_grid=None,
        epsilon_default_grid_km=None,
        epsilon_rounding_km=None,
    ):
        job = JobRepository().get(job_id)
        if job is None:
            raise NotFoundError("Processing job tidak ditemukan.")
        if job.dataset_id != dataset_id or job.job_type != "PARAMETER_SEARCH":
            raise ValidationError("Job tidak cocok dengan dataset atau jenis proses.")
        if job.status == "SUCCESS":
            return {"job_id": job.id, "status": "SUCCESS", "idempotent": True}
        if job.status == "CANCELLED":
            return {"job_id": job.id, "status": "CANCELLED", "revoked": True}
        if job.status == "FAILED":
            raise ConflictError(f"Job tidak dapat dijalankan dari status {job.status}.")

        try:
            with dataset_job_lock("PARAMETER_SEARCH", dataset_id) as acquired:
                if not acquired:
                    return {
                        "job_id": job.id,
                        "status": job.status,
                        "duplicate_delivery": True,
                    }

                job = mark_job_running(
                    job.id,
                    message="Pencarian parameter sedang berjalan.",
                )
                job_checkpoint(job.id, stage="TASK_STARTED", progress=1)
                self.update_state(
                    state="PROGRESS",
                    meta={"job_id": job.id, "progress": 1, "stage": "K_DISTANCE"},
                )
                min_samples_values = sorted({int(value) for value in min_samples_candidates})
                if not min_samples_values or any(value < 2 for value in min_samples_values):
                    raise ValidationError("min_samples_candidates harus berisi integer minimal 2.")

                service = ParameterSearchService(
                    epsilon_default_grid_km=epsilon_default_grid_km,
                    epsilon_rounding_km=epsilon_rounding_km,
                )
                job.current_step = "K_DISTANCE"
                job.progress = max(int(job.progress or 0), 1)
                job.message = "Menghitung kurva K-distance dan Elbow untuk kandidat MinPts."
                db.session.commit()

                # One BallTree-backed KNN query for the largest MinPts candidate.
                elbow_curves = service.calculate_k_distances(
                    dataset_id=dataset_id,
                    min_samples_candidates=min_samples_values,
                )
                job_checkpoint(job.id, stage="K_DISTANCE_COMPLETE", progress=10)
                dataset = DatasetRepository().get(dataset_id)
                try:
                    candidate_plan = service.build_epsilon_candidates(
                        knee_curves=elbow_curves,
                        explicit_eps_candidates_km=eps_candidates_km,
                        sensitivity_percentages=sensitivity_percentages,
                        use_default_grid=use_default_grid,
                    )
                except ProcessingError:
                    # Preserve the attempted configuration and the per-MinPts
                    # Knee failures even when the union contains no candidates.
                    failed_job = JobRepository().get(job.id)
                    if failed_job is not None:
                        failed_payload = dict(failed_job.input_payload or {})
                        failed_metadata = dict(
                            failed_payload.get("parameter_search_metadata") or {}
                        )
                        failed_metadata.update({
                            "candidate_status": "FAILED_NO_CANDIDATES",
                            "epsilon_candidates_km": [],
                            "knee_not_found": sorted(
                                int(curve["min_samples"])
                                for curve in elbow_curves
                                if not curve.get(
                                    "knee_detected",
                                    curve.get("eps_knee_km", curve.get("epsilon_km")) is not None,
                                )
                            ),
                            "knee_detection_errors": [
                                {
                                    "min_samples": int(curve["min_samples"]),
                                    "error": str(curve["knee_detection_error"]),
                                }
                                for curve in elbow_curves
                                if curve.get("knee_detection_error")
                            ],
                            "combination_count": 0,
                        })
                        failed_payload["parameter_search_metadata"] = failed_metadata
                        failed_job.input_payload = failed_payload
                        db.session.commit()
                    raise
                epsilon_values = candidate_plan["eps_candidates_km"]
                search_context = dict(candidate_plan["metadata"])
                combination_count = len(epsilon_values) * len(min_samples_values)
                knee_summary = [
                    {
                        "min_samples": int(c["min_samples"]),
                        "knee_eps_km": c.get("eps_knee_km", c.get("epsilon_km")),
                        "p90_km": float((c.get("k_distance_percentiles_km") or {}).get("p90")) if (c.get("k_distance_percentiles_km") or {}).get("p90") is not None else None,
                        "p95_km": float((c.get("k_distance_percentiles_km") or {}).get("p95")) if (c.get("k_distance_percentiles_km") or {}).get("p95") is not None else None,
                        "p98_km": float((c.get("k_distance_percentiles_km") or {}).get("p98")) if (c.get("k_distance_percentiles_km") or {}).get("p98") is not None else None,
                        "detected": bool(c.get("knee_detected")),
                        "status": "DETECTED" if c.get("knee_detected") else "NOT_DETECTED",
                    }
                    for c in elbow_curves
                ]
                search_context.update({
                    "default_grid": list(search_context.get("default_grid", [])),
                    "default_grid_km": list(search_context.get("default_grid_km", search_context.get("default_grid", []))),
                    "rounding_km": float(search_context.get("rounding_km", service.epsilon_rounding_km)),
                    "epsilon_rounding_km": float(search_context.get("epsilon_rounding_km", search_context.get("rounding_km", service.epsilon_rounding_km))),
                    "knee_not_found": list(search_context.get("knee_not_found", [])),
                    "knee_not_detected_min_samples": list(search_context.get("knee_not_detected_min_samples", search_context.get("knee_not_found", []))),
                    "knee_summary": knee_summary,
                    "use_default_grid": bool(search_context.get("use_default_grid", True)),
                    "combination_mode": "cross",
                    "epsilon_candidates_km": list(epsilon_values),
                    "min_samples_candidates": list(min_samples_values),
                    "epsilon_candidate_count": len(epsilon_values),
                    "combination_count": combination_count,
                    "candidate_status": "RESOLVED",
                })

                # Persist the resolved candidate set and method configuration at
                # job level, separately from the original request inputs.
                job = JobRepository().get(job.id)
                if job is None:
                    raise NotFoundError("Processing job tidak ditemukan.")
                input_payload = dict(job.input_payload or {})
                input_payload["parameter_search_metadata"] = search_context
                job.input_payload = input_payload
                job.current_step = "PARAMETER_SEARCH"
                job.message = (
                    f"Menjalankan {combination_count} kombinasi: "
                    f"{len(epsilon_values)} epsilon × {len(min_samples_values)} MinPts."
                )
                db.session.commit()
                current_app.logger.info(
                    "parameter_search_candidates_resolved",
                    extra={
                        "job_id": job.id,
                        "dataset_id": dataset_id,
                        "epsilon_candidate_count": len(epsilon_values),
                        "min_samples_candidate_count": len(min_samples_values),
                        "combination_count": combination_count,
                        "epsilon_candidates_km": epsilon_values,
                        "knee_not_found": search_context.get("knee_not_found", []),
                    },
                )

                ElbowArtifactService().save_job_artifacts(
                    dataset=dataset,
                    job=job,
                    curves=elbow_curves,
                    search_context=search_context,
                )
                job_checkpoint(job.id, stage="ELBOW_ARTIFACTS_COMPLETE", progress=15)

                result = service.run_search(
                    dataset_id=dataset_id,
                    eps_candidates_km=epsilon_values,
                    min_samples_candidates=min_samples_values,
                    created_by=job.created_by,
                    celery_task_id=self.request.id,
                    job_id=job.id,
                    checkpoint_callback=lambda **state: job_checkpoint(
                        job.id, **state
                    ),
                    eps_sources_by_km=candidate_plan["eps_sources_by_km"],
                    epsilon_search_metadata=search_context,
                )
                self.update_state(
                    state="SUCCESS",
                    meta={
                        "job_id": job.id,
                        "progress": 100,
                        "experiment_count": len(result["experiments"]),
                    },
                )
                return {
                    "job_id": job.id,
                    "status": "SUCCESS",
                    "experiment_ids": [item.id for item in result["experiments"]],
                }

        except (JobPaused, JobCancelled) as control_signal:
            db.session.expire_all()
            current = JobRepository().get(job_id)
            return {
                "job_id": job_id,
                "status": current.status if current is not None else "CANCELLED",
                "checkpoint": current.checkpoint_data if current is not None else {},
            }
        except (OperationalError, RedisError) as exc:
            if self.request.retries >= self.max_retries:
                mark_job_failed(job.id, exc, code="TRANSIENT_RETRIES_EXHAUSTED")
                raise
            reset_job_for_retry(job.id)
            raise self.retry(
                exc=exc,
                countdown=min(2 ** (self.request.retries + 1), 30),
            )
        except Exception as exc:
            mark_job_failed(job.id, exc, code="PARAMETER_SEARCH_FAILED")
            if isinstance(exc, ProcessingError):
                failed_job = JobRepository().get(job.id)
                if failed_job is not None:
                    failed_job.message = str(exc)[:500]
                    failed_job.error_detail = str(exc)[:4000]
                    db.session.commit()
            raise

    return run_parameter_search
