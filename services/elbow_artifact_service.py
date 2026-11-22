"""Persist reproducible DBSCAN k-distance curves and visual artifacts."""

from __future__ import annotations

import csv
import json
import os
import shutil
from pathlib import Path
from uuid import uuid4

import numpy as np

from extensions import db
from repositories.artifact_repository import ArtifactRepository
from services.artifact_service import ArtifactService
from services.exceptions import ProcessingError
from services.utils import EARTH_RADIUS_KM


class ElbowArtifactService:
    """Write job-scoped artifacts and register them in processing_artifacts."""

    def __init__(self, *, artifact_root=None, artifact_service=None):
        if artifact_root is None:
            from flask import current_app
            artifact_root = current_app.config["ARTIFACT_DIR"]
        self.root = Path(artifact_root).expanduser().resolve()
        self.artifacts = artifact_service or ArtifactService()
        self.repository = ArtifactRepository()

    @staticmethod
    def _preview(curve, max_points=1500):
        values = np.asarray(curve["k_distance_km"], dtype=np.float64)
        if len(values) <= max_points:
            indices = np.arange(len(values), dtype=np.int64)
        else:
            indices = np.linspace(0, len(values) - 1, max_points, dtype=np.int64)
        required = {0, len(values) - 1}
        knee_index = curve.get("knee_index")
        if knee_index is not None and 1 <= int(knee_index) <= len(values):
            required.add(int(knee_index) - 1)
        cutoff_count = curve.get("knee_input_point_count")
        if cutoff_count is not None and 1 <= int(cutoff_count) <= len(values):
            required.add(int(cutoff_count) - 1)
        indices = np.asarray(sorted(set(indices.tolist()) | required), dtype=np.int64)
        return [
            {"rank": int(index + 1), "distance_km": float(values[index])}
            for index in indices
        ]

    @staticmethod
    def _write_json(path, payload):
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        os.replace(temporary, path)

    @staticmethod
    def _plot_curve(path, curve, *, dataset_id, job_id):
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        values = np.asarray(curve["k_distance_km"], dtype=np.float64)
        ranks = np.arange(1, len(values) + 1)
        fig, ax = plt.subplots(figsize=(10, 5.8), constrained_layout=True)
        ax.plot(ranks, values, linewidth=1.35, label="K-distance")
        knee_index = curve.get("knee_index")
        epsilon = curve.get("epsilon_km")
        if knee_index is not None and epsilon is not None:
            ax.scatter([knee_index], [epsilon], s=55, zorder=4, label="Knee point")
            ax.axhline(epsilon, linestyle="--", linewidth=1.1, label=f"Epsilon = {epsilon:.6f} km")
            ax.axvline(knee_index, linestyle=":", linewidth=1.0)
        cutoff_count = curve.get("knee_input_point_count")
        if cutoff_count is not None and 1 <= int(cutoff_count) <= len(values):
            ax.axvline(
                int(cutoff_count), linestyle="-.", linewidth=1.0,
                label=f"Knee input cutoff ({curve.get('knee_input_cutoff', 'p95')})",
            )
        if knee_index is None or epsilon is None:
            ax.text(
                0.02, 0.96, "Knee point tidak terdeteksi",
                transform=ax.transAxes, va="top",
            )
        ax.set_title(
            f"K-Distance / Elbow — MinPts {curve['min_samples']}\n"
            f"Dataset {dataset_id} | Job {job_id} | Haversine"
        )
        ax.set_xlabel("Data points (sorted ascending)")
        ax.set_ylabel("K-distance (km)")
        ax.grid(True, alpha=0.25)
        ax.legend(loc="best")
        fig.savefig(path, format="png", dpi=150)
        plt.close(fig)

    @staticmethod
    def _plot_comparison(path, curves, *, dataset_id, job_id):
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(11, 6.2), constrained_layout=True)
        for curve in curves:
            values = np.asarray(curve["k_distance_km"], dtype=np.float64)
            ranks = np.arange(1, len(values) + 1)
            ax.plot(ranks, values, linewidth=1.25, label=f"MinPts {curve['min_samples']}")
            if curve.get("knee_index") is not None and curve.get("epsilon_km") is not None:
                idx = int(curve["knee_index"])
                ax.scatter([idx], [curve["epsilon_km"]], s=28, zorder=4)
        ax.set_title(f"K-Distance Comparison — Dataset {dataset_id} | Job {job_id}")
        ax.set_xlabel("Data points (sorted ascending)")
        ax.set_ylabel("K-distance (km)")
        ax.grid(True, alpha=0.25)
        ax.legend(loc="best")
        fig.savefig(path, format="png", dpi=150)
        plt.close(fig)

    def save_job_artifacts(self, *, dataset, job, curves, search_context=None):
        if not curves:
            raise ProcessingError("Tidak ada kurva K-distance untuk disimpan.")
        job_root = self.root / "parameter_search" / f"dataset_{dataset.id}" / f"job_{job.id}"
        attempt_dir = job_root / f"attempt_{uuid4().hex}"
        curve_dir = attempt_dir / "elbow"
        comparison_dir = attempt_dir / "comparison"
        curve_dir.mkdir(parents=True, exist_ok=True)
        comparison_dir.mkdir(parents=True, exist_ok=True)

        # Idempotent retry: replace registry rows transactionally. Old files are
        # retained until the new artifact rows commit successfully.
        previous = self.repository.list_for_job(job.id)
        previous_paths = [
            Path(item.storage_path) for item in previous
            if (item.artifact_metadata or {}).get("analysis") == "elbow"
        ]
        for artifact in previous:
            metadata = artifact.artifact_metadata or {}
            if metadata.get("analysis") == "elbow":
                db.session.delete(artifact)

        generated_paths = []
        try:
            for curve in curves:
                min_samples = int(curve["min_samples"])
                stem = f"minpts_{min_samples}"
                csv_path = curve_dir / f"{stem}.csv"
                json_path = curve_dir / f"{stem}.json"
                png_path = curve_dir / f"{stem}.png"

                values = np.asarray(curve["k_distance_km"], dtype=np.float64)
                temporary_csv = csv_path.with_suffix(".csv.tmp")
                with temporary_csv.open("w", newline="", encoding="utf-8") as stream:
                    writer = csv.writer(stream)
                    writer.writerow(["rank", "distance_km"])
                    writer.writerows((index + 1, format(float(value), ".12g")) for index, value in enumerate(values))
                os.replace(temporary_csv, csv_path)
                generated_paths.append(csv_path)

                preview = self._preview(curve)
                metadata = {
                    "analysis": "elbow",
                    "kind": "curve_metadata",
                    "dataset_id": int(dataset.id),
                    "dataset_hash_sha256": dataset.file_hash_sha256,
                    "preprocessing_version": dataset.preprocessing_version,
                    "job_id": int(job.id),
                    "min_samples": min_samples,
                    "metric": "haversine",
                    "earth_radius_km": EARTH_RADIUS_KM,
                    "distance_unit": "km",
                    "point_count": int(len(values)),
                    "method_version": curve.get("method_version", "4.1.1"),
                    "k_distance_percentiles_km": curve.get("k_distance_percentiles_km", {}),
                    "percentile_method": curve.get("percentile_method", "linear"),
                    "knee_input_cutoff": curve.get("knee_input_cutoff", "p95"),
                    "knee_input_point_count": curve.get("knee_input_point_count"),
                    "knee_index": curve.get("knee_index"),
                    "eps_knee_km": curve.get("eps_knee_km", curve.get("epsilon_km")),
                    "search_configuration": search_context or {},
                    "knee_detection": {
                        "method": "kneedle",
                        "curve": "convex",
                        "direction": "increasing",
                        "input_cutoff": curve.get("knee_input_cutoff", "p95"),
                        "input_point_count": curve.get("knee_input_point_count"),
                        "detected": bool(curve.get("knee_detected")),
                        "rank_1_based": curve.get("knee_index"),
                        "eps_knee_km": curve.get("eps_knee_km", curve.get("epsilon_km")),
                        "epsilon_km": curve.get("epsilon_km"),
                        "epsilon_radian": curve.get("epsilon_radian"),
                    },
                    "preview_points": preview,
                    "files": {
                        "curve_data": csv_path.name,
                        "curve_plot": png_path.name,
                        "curve_metadata": json_path.name,
                    },
                }
                self._write_json(json_path, metadata)
                generated_paths.append(json_path)
                self._plot_curve(png_path, curve, dataset_id=dataset.id, job_id=job.id)
                generated_paths.append(png_path)

                common = {
                    "analysis": "elbow",
                    "min_samples": min_samples,
                    "metric": "haversine",
                    "earth_radius_km": EARTH_RADIUS_KM,
                    "point_count": int(len(values)),
                    "knee_detected": bool(curve.get("knee_detected")),
                    "knee_input_cutoff": curve.get("knee_input_cutoff", "p95"),
                    "knee_input_point_count": curve.get("knee_input_point_count"),
                    "k_distance_percentiles_km": curve.get("k_distance_percentiles_km", {}),
                    "method_version": curve.get("method_version", "4.1.1"),
                    "epsilon_km": curve.get("epsilon_km"),
                }
                self.artifacts.register_file(
                    dataset_id=dataset.id, job_id=job.id,
                    artifact_type="K_DISTANCE_DATA", file_path=csv_path,
                    mime_type="text/csv", metadata={**common, "kind": "curve_data"},
                    commit=False,
                )
                self.artifacts.register_file(
                    dataset_id=dataset.id, job_id=job.id,
                    artifact_type="K_DISTANCE_DATA", file_path=json_path,
                    mime_type="application/json",
                    metadata={**common, "kind": "curve_metadata", "knee_index": curve.get("knee_index"), "epsilon_radian": curve.get("epsilon_radian")},
                    commit=False,
                )
                self.artifacts.register_file(
                    dataset_id=dataset.id, job_id=job.id,
                    artifact_type="K_DISTANCE_PLOT", file_path=png_path,
                    mime_type="image/png", metadata={**common, "kind": "curve_plot"},
                    commit=False,
                )

            comparison_path = comparison_dir / "elbow_comparison.png"
            self._plot_comparison(
                comparison_path, curves, dataset_id=dataset.id, job_id=job.id
            )
            generated_paths.append(comparison_path)
            self.artifacts.register_file(
                dataset_id=dataset.id, job_id=job.id,
                artifact_type="K_DISTANCE_PLOT", file_path=comparison_path,
                mime_type="image/png",
                metadata={
                    "analysis": "elbow", "kind": "comparison_plot",
                    "curve_count": len(curves), "metric": "haversine",
                },
                commit=False,
            )
            db.session.commit()
            # Remove superseded files only after the new registry transaction commits.
            for old_path in previous_paths:
                try:
                    old_path.unlink(missing_ok=True)
                except OSError:
                    pass
            try:
                for old_dir in sorted(
                    {path.parent for path in previous_paths},
                    key=lambda item: len(item.parts), reverse=True,
                ):
                    if old_dir.exists() and old_dir.is_dir() and not any(old_dir.iterdir()):
                        old_dir.rmdir()
            except OSError:
                pass
            return {
                "artifact_count": len(curves) * 3 + 1,
                "curve_count": len(curves),
                "comparison_plot": str(comparison_path),
            }
        except Exception:
            db.session.rollback()
            shutil.rmtree(attempt_dir, ignore_errors=True)
            raise
