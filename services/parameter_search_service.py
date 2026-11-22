"""Haversine DBSCAN parameter exploration and k-distance calculation."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import numpy as np
from kneed import KneeLocator
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
from sqlalchemy.orm.attributes import flag_modified

from extensions import db
from models.experiment import DBSCANParameterExperiment
from models.job import ProcessingJob
from repositories.dataset_repository import DatasetRepository
from repositories.earthquake_repository import EarthquakeRepository
from repositories.experiment_repository import ExperimentRepository
from repositories.job_repository import JobRepository
from services.exceptions import (
    ConflictError,
    NotFoundError,
    ValidationError,
    JobPaused,
    JobCancelled,
    ProcessingError,
)
from services.utils import EARTH_RADIUS_KM, utc_now
from services.clustering_evaluation_service import ClusteringEvaluationService


class ParameterSearchService:
    METHOD_VERSION = "4.1.4"
    KNEE_INPUT_CUTOFF = "p95"
    DEFAULT_SENSITIVITY_PERCENTAGES = (-20.0, -10.0, 0.0, 10.0, 20.0)
    DEFAULT_EPSILON_GRID_KM = (10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0, 60.0, 75.0, 100.0)
    DEFAULT_EPSILON_ROUNDING_KM = 0.5
    MAX_EXPLICIT_EPSILON_KM = 1000.0
    COMBINATION_MODE = "cross"
    def __init__(
        self,
        dataset_repository=None,
        earthquake_repository=None,
        job_repository=None,
        experiment_repository=None,
        *,
        silhouette_max_sample=None,
        random_state=None,
        evaluation_service=None,
        epsilon_default_grid_km=None,
        epsilon_rounding_km=None,
        use_default_epsilon_grid=None,
        validity_thresholds=None,
        recommendation_weights=None,
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
        self.jobs = job_repository or JobRepository()
        self.experiments = experiment_repository or ExperimentRepository()
        self.silhouette_max_sample = int(silhouette_max_sample)
        self.random_state = int(random_state)
        self.epsilon_default_grid_km = tuple(
            configured("EPSILON_DEFAULT_GRID_KM", self.DEFAULT_EPSILON_GRID_KM)
            if epsilon_default_grid_km is None else epsilon_default_grid_km
        )
        self.epsilon_rounding_km = float(
            configured("EPSILON_ROUNDING_KM", self.DEFAULT_EPSILON_ROUNDING_KM)
            if epsilon_rounding_km is None else epsilon_rounding_km
        )
        self.use_default_epsilon_grid = bool(
            configured("EPSILON_USE_DEFAULT_GRID", True)
            if use_default_epsilon_grid is None else use_default_epsilon_grid
        )
        raw_thresholds = (
            configured("VALIDITY_THRESHOLDS", self.DEFAULT_VALIDITY_THRESHOLDS)
            if validity_thresholds is None else validity_thresholds
        )
        self.validity_thresholds = self._normalize_validity_thresholds(
            raw_thresholds
        )
        raw_weights = (
            configured("RECOMMENDATION_WEIGHTS", self.DEFAULT_RECOMMENDATION_WEIGHTS)
            if recommendation_weights is None else recommendation_weights
        )
        self.recommendation_weights = self._normalize_recommendation_weights(
            raw_weights
        )
        self.evaluator = evaluation_service or ClusteringEvaluationService(
            silhouette_max_sample=self.silhouette_max_sample,
            random_state=self.random_state,
        )

    DEFAULT_VALIDITY_THRESHOLDS = {
        "min_clusters": 2,
        "max_clusters": 80,
        "max_noise_percentage": 40.0,
        "max_largest_cluster_ratio": 0.60,
    }

    DEFAULT_RECOMMENDATION_WEIGHTS = {
        "silhouette": 0.4,
        "noise_percentage": 0.2,
        "largest_cluster_ratio": 0.2,
        "stability_score": 0.2,
    }

    @classmethod
    def _normalize_recommendation_weights(cls, weights):
        if not isinstance(weights, dict):
            raise ValueError("RECOMMENDATION_WEIGHTS harus berupa dictionary.")

        values = dict(cls.DEFAULT_RECOMMENDATION_WEIGHTS)
        values.update(weights)

        required = set(cls.DEFAULT_RECOMMENDATION_WEIGHTS)
        if set(values) != required:
            raise ValueError("Key RECOMMENDATION_WEIGHTS tidak sesuai.")

        for key in required:
            val = float(values[key])
            if not np.isfinite(val) or val < 0:
                raise ValueError(f"Bobot {key} harus angka non-negatif finite.")
            values[key] = val

        total = sum(values.values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Total bobot harus bernilai 1.0 (didapat {total}).")

        return values

    @classmethod
    def _normalize_validity_thresholds(cls, thresholds):
        if not isinstance(thresholds, dict):
            raise ValueError("VALIDITY_THRESHOLDS harus berupa dictionary.")

        values = dict(cls.DEFAULT_VALIDITY_THRESHOLDS)
        values.update(thresholds)

        required = cls.DEFAULT_VALIDITY_THRESHOLDS
        if set(values) != set(required):
            raise ValueError("Key VALIDITY_THRESHOLDS tidak sesuai.")

        for key in ("min_clusters", "max_clusters"):
            value = values[key]
            if isinstance(value, bool) or int(value) != float(value):
                raise ValueError(f"{key} harus berupa bilangan bulat.")
            values[key] = int(value)

        for key in ("max_noise_percentage", "max_largest_cluster_ratio"):
            value = float(values[key])
            if not np.isfinite(value):
                raise ValueError(f"{key} harus finite.")
            values[key] = value

        if values["min_clusters"] < 1:
            raise ValueError("min_clusters minimal 1.")
        if values["max_clusters"] < values["min_clusters"]:
            raise ValueError("max_clusters tidak boleh di bawah min_clusters.")
        if not 0 <= values["max_noise_percentage"] <= 100:
            raise ValueError("max_noise_percentage harus 0 sampai 100.")
        if not 0 < values["max_largest_cluster_ratio"] <= 1:
            raise ValueError("max_largest_cluster_ratio harus > 0 sampai 1.")

        return values

    @staticmethod
    def _evaluate_validity(
        cluster_count,
        noise_percentage,
        largest_cluster_ratio,
        thresholds,
    ):
        reasons = []

        if cluster_count < thresholds["min_clusters"]:
            reasons.append("CLUSTER_COUNT_BELOW_MINIMUM")

        if cluster_count > thresholds["max_clusters"]:
            reasons.append("CLUSTER_COUNT_ABOVE_MAXIMUM")

        if noise_percentage is None:
            reasons.append("NOISE_PERCENTAGE_UNAVAILABLE")
        elif noise_percentage > thresholds["max_noise_percentage"]:
            reasons.append("NOISE_PERCENTAGE_ABOVE_MAXIMUM")

        if largest_cluster_ratio is None:
            reasons.append("LARGEST_CLUSTER_RATIO_UNAVAILABLE")
        elif largest_cluster_ratio > thresholds["max_largest_cluster_ratio"]:
            reasons.append("LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM")

        return not reasons, reasons

    @classmethod
    def calculate_grid_stability(cls, experiments):
        """Hitung skor stabilitas terhadap tetangga grid ortogonal (T7).

        Mengambil maksimal 4 tetangga ortogonal yang tersedia:
        - (eps[i-1], minpts[j])
        - (eps[i+1], minpts[j])
        - (eps[i], minpts[j-1])
        - (eps[i], minpts[j+1])
        """
        if not experiments:
            return experiments

        def _get(item, attr, default=None):
            if isinstance(item, dict):
                return item.get(attr, default)
            return getattr(item, attr, default)

        def _set(item, attr, value):
            if isinstance(item, dict):
                item[attr] = value
            else:
                setattr(item, attr, value)

        grid = {}
        eps_set = set()
        minpts_set = set()

        for exp in experiments:
            raw_eps = _get(exp, "eps_km")
            raw_minpts = _get(exp, "min_samples")
            if raw_eps is None or raw_minpts is None:
                continue
            eps_val = round(float(raw_eps), 12)
            minpts_val = int(raw_minpts)
            eps_set.add(eps_val)
            minpts_set.add(minpts_val)
            grid[(eps_val, minpts_val)] = exp

        sorted_eps = sorted(eps_set)
        sorted_minpts = sorted(minpts_set)

        eps_idx = {val: idx for idx, val in enumerate(sorted_eps)}
        minpts_idx = {val: idx for idx, val in enumerate(sorted_minpts)}

        for exp in experiments:
            raw_eps = _get(exp, "eps_km")
            raw_minpts = _get(exp, "min_samples")
            if raw_eps is None or raw_minpts is None:
                continue

            eps_val = round(float(raw_eps), 12)
            minpts_val = int(raw_minpts)
            i = eps_idx[eps_val]
            j = minpts_idx[minpts_val]

            raw_k = _get(exp, "cluster_count")
            k_val = int(raw_k) if raw_k is not None else 0

            # Tetangga pada sumbu epsilon (min_samples tetap pada j)
            eps_neighbors = []
            if i > 0:
                left_key = (sorted_eps[i - 1], sorted_minpts[j])
                if left_key in grid:
                    eps_neighbors.append(grid[left_key])
            if i + 1 < len(sorted_eps):
                right_key = (sorted_eps[i + 1], sorted_minpts[j])
                if right_key in grid:
                    eps_neighbors.append(grid[right_key])

            # Tetangga pada sumbu min_samples (epsilon tetap pada i)
            minpts_neighbors = []
            if j > 0:
                down_key = (sorted_eps[i], sorted_minpts[j - 1])
                if down_key in grid:
                    minpts_neighbors.append(grid[down_key])
            if j + 1 < len(sorted_minpts):
                up_key = (sorted_eps[i], sorted_minpts[j + 1])
                if up_key in grid:
                    minpts_neighbors.append(grid[up_key])

            eps_neighbor_count = len(eps_neighbors)
            min_samples_neighbor_count = len(minpts_neighbors)
            all_neighbors = eps_neighbors + minpts_neighbors
            neighbor_count = len(all_neighbors)

            if neighbor_count == 0:
                stability_score = None
                mean_rel_diff = None
            else:
                rel_diffs = []
                for nb in all_neighbors:
                    nb_raw_k = _get(nb, "cluster_count")
                    k_n = int(nb_raw_k) if nb_raw_k is not None else 0
                    if k_val == 0 and k_n == 0:
                        rel_diff = 0.0
                    else:
                        rel_diff = abs(k_val - k_n) / max(k_val, k_n, 1)
                    rel_diffs.append(rel_diff)

                mean_rel_diff = float(np.mean(rel_diffs))
                stability_score = float(max(0.0, min(1.0, 1.0 - mean_rel_diff)))

            _set(exp, "stability_score", stability_score)

            metadata = {
                **(_get(exp, "evaluation_metadata", {}) or {}),
                "stability_score": stability_score,
                "stability": {
                    "neighbor_count": neighbor_count,
                    "eps_neighbor_count": eps_neighbor_count,
                    "min_samples_neighbor_count": min_samples_neighbor_count,
                    "mean_relative_cluster_change": mean_rel_diff,
                },
            }
            _set(exp, "evaluation_metadata", metadata)

            if hasattr(exp, "__table__"):
                flag_modified(exp, "evaluation_metadata")

        return experiments

    @classmethod
    def calculate_multicriteria_recommendations(cls, experiments, weights=None, job=None):
        """Hitung rekomendasi multikriteria (T8) untuk seluruh eksperimen dalam satu job.

        Bobot:
        - silhouette: 0.4 (higher-is-better)
        - noise_percentage: 0.2 (lower-is-better)
        - largest_cluster_ratio: 0.2 (lower-is-better)
        - stability_score: 0.2 (higher-is-better)
        """
        weights_config = cls._normalize_recommendation_weights(
            weights if weights is not None else cls.DEFAULT_RECOMMENDATION_WEIGHTS
        )

        if not experiments:
            if job is not None:
                cls._persist_job_recommendation_summary(
                    job, status="NO_VALID_EXPERIMENT", weights=weights_config, winner=None
                )
            return experiments

        def _get(item, attr, default=None):
            if isinstance(item, dict):
                return item.get(attr, default)
            return getattr(item, attr, default)

        def _set(item, attr, value):
            if isinstance(item, dict):
                item[attr] = value
            else:
                setattr(item, attr, value)

        def _get_lcr(item):
            meta = _get(item, "evaluation_metadata") or {}
            lcr = _get(item, "largest_cluster_ratio")
            if lcr is not None:
                return float(lcr)
            lcr_meta = meta.get("largest_cluster_ratio")
            if lcr_meta is not None:
                return float(lcr_meta)
            max_c = _get(item, "max_cluster_size")
            clustered = _get(item, "clustered_count")
            if max_c is not None and clustered and clustered > 0:
                return float(max_c) / float(clustered)
            return None

        # 1. Filter pool valid: is_valid == True DAN silhouette_score is not None
        valid_pool = []
        for exp in experiments:
            is_valid = bool(_get(exp, "is_valid", False))
            sil = _get(exp, "silhouette_score")
            sil_valid = sil is not None and np.isfinite(float(sil))
            if is_valid and sil_valid:
                valid_pool.append(exp)
            else:
                _set(exp, "is_recommended", False)
                if hasattr(exp, "recommendation_score"):
                    _set(exp, "recommendation_score", None)
                meta = {
                    **(_get(exp, "evaluation_metadata", {}) or {}),
                    "recommendation_score": None,
                    "is_recommended": False,
                    "recommendation": {
                        "status": "INVALID" if not is_valid else "NOT_ELIGIBLE",
                        "score": None,
                        "is_recommended": False,
                        "normalized_scores": None,
                        "weights_used": None,
                    },
                }
                _set(exp, "evaluation_metadata", meta)
                if hasattr(exp, "__table__"):
                    flag_modified(exp, "evaluation_metadata")

        # 2. Jika tidak ada eksperimen valid sama sekali
        if not valid_pool:
            for exp in experiments:
                _set(exp, "is_recommended", False)
                if hasattr(exp, "recommendation_score"):
                    _set(exp, "recommendation_score", None)
                meta = {
                    **(_get(exp, "evaluation_metadata", {}) or {}),
                    "recommendation_score": None,
                    "is_recommended": False,
                    "recommendation": {
                        "status": "NO_VALID_EXPERIMENT",
                        "score": None,
                        "is_recommended": False,
                        "normalized_scores": None,
                        "weights_used": None,
                    },
                }
                _set(exp, "evaluation_metadata", meta)
                if hasattr(exp, "__table__"):
                    flag_modified(exp, "evaluation_metadata")

            if job is not None:
                cls._persist_job_recommendation_summary(
                    job, status="NO_VALID_EXPERIMENT", weights=weights_config, winner=None
                )
            return experiments

        # 3. Hitung min dan max HANYA dari valid_pool
        sil_vals = [float(_get(e, "silhouette_score")) for e in valid_pool]
        noise_vals = [float(_get(e, "noise_percentage")) for e in valid_pool]
        lcr_vals = [float(_get_lcr(e) if _get_lcr(e) is not None else 0.0) for e in valid_pool]
        stab_vals = [
            float(_get(e, "stability_score"))
            for e in valid_pool
            if _get(e, "stability_score") is not None and np.isfinite(float(_get(e, "stability_score")))
        ]

        min_sil, max_sil = min(sil_vals), max(sil_vals)
        min_noise, max_noise = min(noise_vals), max(noise_vals)
        min_lcr, max_lcr = min(lcr_vals), max(lcr_vals)
        min_stab = min(stab_vals) if stab_vals else None
        max_stab = max(stab_vals) if stab_vals else None

        # 4. Normalisasi dan hitung recommendation_score per kandidat valid
        candidates_data = []

        for exp in valid_pool:
            sil = float(_get(exp, "silhouette_score"))
            noise = float(_get(exp, "noise_percentage"))
            lcr = float(_get_lcr(exp) if _get_lcr(exp) is not None else 0.0)
            raw_stab = _get(exp, "stability_score")
            stab = float(raw_stab) if raw_stab is not None and np.isfinite(float(raw_stab)) else None

            # Higher-is-better: silhouette
            if max_sil == min_sil:
                norm_sil = 1.0
            else:
                norm_sil = (sil - min_sil) / (max_sil - min_sil)

            # Lower-is-better: noise_percentage
            if max_noise == min_noise:
                norm_noise = 1.0
            else:
                norm_noise = (max_noise - noise) / (max_noise - min_noise)

            # Lower-is-better: largest_cluster_ratio
            if max_lcr == min_lcr:
                norm_lcr = 1.0
            else:
                norm_lcr = (max_lcr - lcr) / (max_lcr - min_lcr)

            # Higher-is-better: stability_score (jika tersedia)
            if stab is None or min_stab is None or max_stab is None:
                norm_stab = None
            else:
                if max_stab == min_stab:
                    norm_stab = 1.0
                else:
                    norm_stab = (stab - min_stab) / (max_stab - min_stab)

            # Redistribusi bobot jika stability_score is None
            if norm_stab is None:
                active_sum = (
                    weights_config["silhouette"]
                    + weights_config["noise_percentage"]
                    + weights_config["largest_cluster_ratio"]
                )
                weights_used = {
                    "silhouette": weights_config["silhouette"] / active_sum,
                    "noise_percentage": weights_config["noise_percentage"] / active_sum,
                    "largest_cluster_ratio": weights_config["largest_cluster_ratio"] / active_sum,
                    "stability_score": 0.0,
                }
                score = (
                    weights_used["silhouette"] * norm_sil
                    + weights_used["noise_percentage"] * norm_noise
                    + weights_used["largest_cluster_ratio"] * norm_lcr
                )
            else:
                weights_used = dict(weights_config)
                score = (
                    weights_used["silhouette"] * norm_sil
                    + weights_used["noise_percentage"] * norm_noise
                    + weights_used["largest_cluster_ratio"] * norm_lcr
                    + weights_used["stability_score"] * norm_stab
                )

            score = float(max(0.0, min(1.0, score)))
            normalized_scores = {
                "silhouette": float(norm_sil),
                "noise_percentage": float(norm_noise),
                "largest_cluster_ratio": float(norm_lcr),
                "stability_score": float(norm_stab) if norm_stab is not None else None,
            }

            candidates_data.append({
                "exp": exp,
                "score": score,
                "normalized_scores": normalized_scores,
                "weights_used": weights_used,
                "sil": sil,
                "lcr": lcr,
                "noise": noise,
                "stab": stab if stab is not None else -1.0,
                "min_samples": int(_get(exp, "min_samples")),
                "eps_km": float(_get(exp, "eps_km")),
            })

        # 5. Tie-breaking deterministik
        # Kriteria urutan:
        # (0) recommendation_score lebih tinggi
        # (1) silhouette_score lebih tinggi
        # (2) largest_cluster_ratio lebih rendah
        # (3) noise_percentage lebih rendah
        # (4) stability_score lebih tinggi (None = -1.0)
        # (5) min_samples lebih tinggi
        # (6) eps_km lebih rendah
        def sort_key(c):
            return (
                c["score"],
                c["sil"],
                -c["lcr"],
                -c["noise"],
                c["stab"],
                c["min_samples"],
                -c["eps_km"],
            )

        candidates_data.sort(key=sort_key, reverse=True)
        winner_data = candidates_data[0]
        winner_exp = winner_data["exp"]

        # 6. Simpan hasil rekomendasi pada seluruh valid kandidat
        for c in candidates_data:
            exp = c["exp"]
            is_winner = (exp is winner_exp)
            score = c["score"]

            _set(exp, "is_recommended", is_winner)
            if hasattr(exp, "recommendation_score"):
                _set(exp, "recommendation_score", score)

            meta = {
                **(_get(exp, "evaluation_metadata", {}) or {}),
                "recommendation_score": score,
                "is_recommended": is_winner,
                "recommendation": {
                    "status": "RECOMMENDED" if is_winner else "NOT_RECOMMENDED",
                    "score": score,
                    "is_recommended": is_winner,
                    "normalized_scores": c["normalized_scores"],
                    "weights_used": c["weights_used"],
                },
            }
            _set(exp, "evaluation_metadata", meta)
            if hasattr(exp, "__table__"):
                flag_modified(exp, "evaluation_metadata")

        # 7. Simpan ringkasan rekomendasi di metadata job
        if job is not None:
            cls._persist_job_recommendation_summary(
                job,
                status="RECOMMENDED",
                weights=weights_config,
                winner=winner_data,
            )

        return experiments

    @classmethod
    def _persist_job_recommendation_summary(cls, job, *, status, weights, winner):
        def _get(item, attr, default=None):
            if isinstance(item, dict):
                return item.get(attr, default)
            return getattr(item, attr, default)

        payload = dict(getattr(job, "input_payload", {}) or {})
        search_metadata = dict(payload.get("parameter_search_metadata") or {})

        selected_info = None
        if winner is not None:
            w_exp = winner["exp"] if isinstance(winner, dict) and "exp" in winner else winner
            score = float(winner["score"]) if isinstance(winner, dict) and "score" in winner else _get(w_exp, "recommendation_score")
            stab = _get(w_exp, "stability_score")
            selected_info = {
                "id": getattr(w_exp, "id", None),
                "eps_km": float(_get(w_exp, "eps_km")),
                "min_samples": int(_get(w_exp, "min_samples")),
                "recommendation_score": score,
                "silhouette_score": float(_get(w_exp, "silhouette_score")),
                "cluster_count": int(_get(w_exp, "cluster_count")),
                "noise_percentage": float(_get(w_exp, "noise_percentage")),
                "stability_score": float(stab) if stab is not None else None,
            }

        recommendation_summary = {
            "status": status,
            "recommendation_status": status,
            "recommendation_weights": dict(weights),
            "selected_experiment": selected_info,
        }

        search_metadata["recommendation"] = recommendation_summary
        search_metadata["recommendation_status"] = status
        search_metadata["recommendation_weights"] = dict(weights)
        search_metadata["selected_experiment"] = selected_info

        payload["parameter_search_metadata"] = search_metadata
        payload["recommendation_status"] = status
        payload["recommendation_weights"] = dict(weights)
        payload["selected_experiment"] = selected_info

        setattr(job, "input_payload", payload)
        if hasattr(job, "__table__"):
            flag_modified(job, "input_payload")

    @staticmethod
    def _epsilon_key(value):
        """Return a stable decimal key for an already-normalized epsilon value."""
        return format(Decimal(str(value)).normalize(), "f")

    @staticmethod
    def _round_epsilon(value, precision_km):
        """Round to the nearest configured epsilon step using half-up semantics."""
        value_decimal = Decimal(str(value))
        step_decimal = Decimal(str(precision_km))
        steps = (value_decimal / step_decimal).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        return steps * step_decimal

    def build_epsilon_candidates(
        self,
        *,
        knee_curves,
        explicit_eps_candidates_km=None,
        sensitivity_percentages=None,
        use_default_grid=None,
    ):
        """Union Knee-sensitivity, explicit, and optional default-grid epsilons.

        Every raw epsilon is rounded to the configured step before deduplication.
        Provenance is retained for each unique normalized epsilon. The resulting
        epsilon list is later crossed with every MinPts candidate.
        """
        precision = self.epsilon_rounding_km
        if not np.isfinite(precision) or precision <= 0:
            raise ValidationError("EPSILON_ROUNDING_KM harus positif dan finite.")

        include_grid = (
            self.use_default_epsilon_grid if use_default_grid is None else use_default_grid
        )
        if not isinstance(include_grid, bool):
            raise ValidationError("use_default_grid harus berupa boolean.")

        percentages_raw = (
            self.DEFAULT_SENSITIVITY_PERCENTAGES
            if sensitivity_percentages is None else sensitivity_percentages
        )
        if isinstance(percentages_raw, (str, bytes)):
            raise ValidationError("sensitivity_percentages harus berupa array angka.")
        try:
            percentages_input = list(percentages_raw)
            if any(isinstance(value, bool) for value in percentages_input):
                raise ValueError
            percentages = sorted({float(value) for value in percentages_input})
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValidationError("sensitivity_percentages harus berupa angka.") from exc
        if not percentages or any(
            not np.isfinite(value) or not (-100.0 < value <= 500.0)
            for value in percentages
        ):
            raise ValidationError(
                "sensitivity_percentages harus finite, lebih besar dari -100, dan maksimal 500."
            )

        candidates = {}
        raw_count = 0
        source_counts = {
            "knee_sensitivity": 0,
            "explicit_request": 0,
            "default_grid": 0,
        }
        knee_not_found = []

        def add_candidate(
            raw_value, source, source_category, *, reject_if_rounds_to_zero=False
        ):
            nonlocal raw_count
            try:
                raw_decimal = Decimal(str(raw_value))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise ValidationError("Kandidat epsilon harus berupa angka valid.") from exc
            if not raw_decimal.is_finite() or raw_decimal <= 0:
                if source_category == "explicit_request":
                    raise ValidationError(
                        "Epsilon eksplisit harus berupa angka finite lebih besar dari 0 km."
                    )
                if reject_if_rounds_to_zero:
                    raise ValidationError(
                        f"Kandidat dari sumber {source} harus berupa angka finite lebih besar dari 0 km."
                    )
                return
            if (
                reject_if_rounds_to_zero
                and raw_decimal > Decimal(str(self.MAX_EXPLICIT_EPSILON_KM))
            ):
                raise ValidationError(
                    "Epsilon eksplisit tidak boleh melebihi 1.000 km."
                )
            rounded = self._round_epsilon(raw_decimal, precision)
            if rounded <= 0:
                if source_category == "explicit_request":
                    raise ValidationError(
                        f"Epsilon eksplisit {raw_value} km menjadi nol setelah pembulatan "
                        f"{precision:g} km."
                    )
                if reject_if_rounds_to_zero:
                    raise ValidationError(
                        f"Kandidat dari sumber {source} menjadi nol setelah pembulatan "
                        f"{precision:g} km."
                    )
                return
            raw_count += 1
            source_counts[source_category] += 1
            candidates.setdefault(rounded, set()).add(source)

        # Generate sensitivities from each MinPts-specific knee. The resulting
        # epsilon values are intentionally pooled before the cross-product step.
        try:
            curves = list(knee_curves or [])
        except TypeError as exc:
            raise ValidationError("knee_curves harus berupa iterable.") from exc
        for curve in curves:
            if not isinstance(curve, dict):
                raise ValidationError("Setiap knee curve harus berupa objek.")
            min_samples = curve.get("min_samples")
            try:
                min_samples_int = int(min_samples)
                if isinstance(min_samples, bool) or min_samples_int != float(min_samples):
                    raise ValueError
            except (TypeError, ValueError, OverflowError) as exc:
                raise ValidationError("min_samples pada knee curve tidak valid.") from exc
            knee_epsilon = curve.get("eps_knee_km", curve.get("epsilon_km"))
            if knee_epsilon is None:
                knee_not_found.append(min_samples_int)
                continue
            try:
                knee_epsilon = float(knee_epsilon)
            except (TypeError, ValueError, OverflowError) as exc:
                raise ValidationError("eps_knee_km harus berupa angka.") from exc
            if not np.isfinite(knee_epsilon) or knee_epsilon <= 0:
                knee_not_found.append(min_samples_int)
                continue
            for percentage in percentages:
                epsilon = knee_epsilon * (1.0 + percentage / 100.0)
                if epsilon > 0 and np.isfinite(epsilon):
                    source = f"knee:minpts={min_samples_int}:{percentage:+g}%"
                    add_candidate(epsilon, source, "knee_sensitivity")

        # Explicit request candidates are additive, never an alternative strategy.
        if explicit_eps_candidates_km is not None:
            if isinstance(explicit_eps_candidates_km, (str, bytes)):
                raise ValidationError("eps_candidates_km harus berupa array angka.")
            try:
                explicit_values = list(explicit_eps_candidates_km)
            except TypeError as exc:
                raise ValidationError("eps_candidates_km harus berupa array angka.") from exc
            for value in explicit_values:
                if isinstance(value, bool):
                    raise ValidationError("eps_candidates_km harus berupa angka.")
                add_candidate(
                    value,
                    "explicit",
                    "explicit_request",
                    reject_if_rounds_to_zero=True,
                )
        else:
            explicit_values = []

        # Keep the configured grid in metadata even when the request disables it;
        # grid_values below represents only the values actually added as candidates.
        configured_grid_values = list(self.epsilon_default_grid_km)
        grid_values = configured_grid_values if include_grid else []
        if include_grid and not grid_values:
            raise ValidationError("EPSILON_DEFAULT_GRID_KM tidak boleh kosong saat grid aktif.")
        for value in grid_values:
            add_candidate(
                value,
                "grid",
                "default_grid",
                reject_if_rounds_to_zero=True,
            )

        ordered = sorted(candidates)
        if not ordered:
            raise ProcessingError(
                "Tidak ada kandidat epsilon setelah penggabungan Knee sensitivity, "
                "epsilon eksplisit, dan default grid. Aktifkan grid atau berikan kandidat epsilon."
            )

        eps_sources_by_km = {
            self._epsilon_key(value): sorted(candidates[value]) for value in ordered
        }
        candidate_details = [
            {
                "eps_km": float(value),
                "eps_sources": eps_sources_by_km[self._epsilon_key(value)],
            }
            for value in ordered
        ]
        metadata = {
            "method_version": self.METHOD_VERSION,
            "epsilon_candidate_strategy": "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID",
            "combination_mode": self.COMBINATION_MODE,
            "rounding_km": float(precision),
            "epsilon_rounding_km": float(precision),
            "sensitivity_percentages": percentages,
            "explicit_epsilon_candidates_km": [float(value) for value in explicit_values],
            "use_default_grid": include_grid,
            "default_grid": [float(value) for value in configured_grid_values],
            "default_grid_km": [float(value) for value in grid_values],
            "candidate_count_before_deduplication": raw_count,
            "candidate_count_after_deduplication": len(ordered),
            "source_candidate_counts": source_counts,
            "knee_not_found": sorted(set(knee_not_found)),
            "knee_detection_errors": [
                {
                    "min_samples": int(curve["min_samples"]),
                    "error": str(curve["knee_detection_error"]),
                }
                for curve in curves if curve.get("knee_detection_error")
            ],
            # Keep the earlier metadata key as an additive compatibility alias.
            "knee_not_detected_min_samples": sorted(set(knee_not_found)),
            "epsilon_candidates_km": [float(value) for value in ordered],
            "epsilon_candidates": candidate_details,
        }
        return {
            "eps_candidates_km": [float(value) for value in ordered],
            "eps_sources_by_km": eps_sources_by_km,
            "metadata": metadata,
        }

    def calculate_k_distances(self, *, dataset_id, min_samples_candidates):
        """Calculate sorted Haversine k-distance curves using one neighbor query.

        sklearn includes the query point itself when X is explicitly supplied to
        kneighbors. This preserves DBSCAN's min_samples convention: the point
        itself counts as one of its neighbors.
        """
        if not self.datasets.get(dataset_id):
            raise NotFoundError("Dataset tidak ditemukan.")

        try:
            raw_candidates = list(min_samples_candidates)
            if any(
                isinstance(value, bool)
                or int(value) != float(value)
                for value in raw_candidates
            ):
                raise ValueError
            candidates = sorted({int(value) for value in raw_candidates})
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValidationError("min_samples_candidates harus berupa integer.") from exc
        if not candidates or any(value < 2 for value in candidates):
            raise ValidationError("min_samples_candidates harus berisi integer minimal 2.")

        coordinates_deg = np.asarray(
            self.earthquakes.coordinates_for_dataset(dataset_id), dtype=np.float64
        )
        if coordinates_deg.ndim != 2 or coordinates_deg.shape[1] != 2:
            raise ValidationError("Koordinat dataset harus memiliki latitude dan longitude.")
        if len(coordinates_deg) < max(candidates):
            raise ValidationError("Jumlah titik lebih kecil daripada kandidat min_samples terbesar.")
        if not np.isfinite(coordinates_deg).all():
            raise ValidationError("Koordinat dataset mengandung nilai non-finite.")
        if np.any((coordinates_deg[:, 0] < -90) | (coordinates_deg[:, 0] > 90)):
            raise ValidationError("Latitude harus berada pada rentang -90 sampai 90 derajat.")
        if np.any((coordinates_deg[:, 1] < -180) | (coordinates_deg[:, 1] > 180)):
            raise ValidationError("Longitude harus berada pada rentang -180 sampai 180 derajat.")
        coordinates = np.radians(coordinates_deg)

        # NearestNeighbors selects BallTree for algorithm='ball_tree'. Query once
        # at the largest k; smaller k curves reuse the corresponding columns.
        neighbors = NearestNeighbors(
            n_neighbors=max(candidates),
            metric="haversine",
            algorithm="ball_tree",
        )
        neighbors.fit(coordinates)
        distances_rad, _ = neighbors.kneighbors(
            coordinates,
            n_neighbors=max(candidates),
            return_distance=True,
        )

        results = []
        for min_samples in candidates:
            # Column k-1 corresponds to the k-th neighbor, including self.
            # Keep the full sorted curve for analysis and artifacts.
            sorted_km = np.sort(
                distances_rad[:, min_samples - 1] * EARTH_RADIUS_KM
            )

            # Percentiles describe the complete curve, not the truncated Knee input.
            p90_km, p95_km, p98_km = np.percentile(sorted_km, [90, 95, 98])

            # KneeLocator receives only the first ceil(95% * N) sorted observations.
            # The x-axis remains the original 1-based rank, so the returned knee
            # rank maps directly back to the full sorted_km array.
            knee_input_point_count = max(
                2,
                min(len(sorted_km), int(np.ceil(len(sorted_km) * 0.95))),
            )
            knee_input_km = sorted_km[:knee_input_point_count]
            knee_input_ranks = np.arange(1, knee_input_point_count + 1)
            knee_detection_error = None
            try:
                knee = KneeLocator(
                    knee_input_ranks,
                    knee_input_km,
                    curve="convex",
                    direction="increasing",
                ).knee
            except Exception as exc:
                # A curve-specific KneeLocator failure must not suppress the
                # remaining MinPts curves or the explicit/default epsilon sources.
                knee = None
                knee_detection_error = f"{type(exc).__name__}: {exc}"[:300]
            knee_index = int(knee) if knee is not None else None  # original 1-based rank
            if knee_index is not None and not 1 <= knee_index <= knee_input_point_count:
                knee_index = None
            epsilon_km = (
                float(sorted_km[knee_index - 1])
                if knee_index is not None
                else None
            )
            percentiles_km = {
                "p90": float(p90_km),
                "p95": float(p95_km),
                "p98": float(p98_km),
            }
            results.append({
                "dataset_id": dataset_id,
                "min_samples": min_samples,
                "k_distance_km": sorted_km,
                "k_distance_percentiles_km": percentiles_km,
                "percentile_method": "linear",
                "knee_input_cutoff": self.KNEE_INPUT_CUTOFF,
                "knee_input_point_count": int(knee_input_point_count),
                "knee_index": knee_index,
                "knee_detected": knee_index is not None,
                "knee_detection_error": knee_detection_error,
                "eps_knee_km": epsilon_km,
                # Keep legacy keys for existing task and API consumers.
                "epsilon_km": epsilon_km,
                "epsilon_radian": (
                    epsilon_km / EARTH_RADIUS_KM if epsilon_km is not None else None
                ),
                "method_version": self.METHOD_VERSION,
                "earth_radius_km": EARTH_RADIUS_KM,
                "metric": "haversine",
                "point_count": int(len(sorted_km)),
            })
        return results

    def calculate_k_distance(self, *, dataset_id, min_samples):
        """Backward-compatible single-MinPts wrapper."""
        result = self.calculate_k_distances(
            dataset_id=dataset_id,
            min_samples_candidates=[min_samples],
        )[0]
        # Preserve the original public return contract (a Python list).
        result["k_distance_km"] = result["k_distance_km"].tolist()
        return result
    def run_search(
        self,
        *,
        dataset_id,
        eps_candidates_km,
        min_samples_candidates,
        created_by,
        celery_task_id=None,
        job_id=None,
        checkpoint_callback=None,
        eps_sources_by_km=None,
        epsilon_search_metadata=None,
    ):
        dataset = self.datasets.get(dataset_id)
        if dataset is None:
            raise NotFoundError("Dataset tidak ditemukan.")

        try:
            raw_eps = list(eps_candidates_km)
            if any(isinstance(value, bool) for value in raw_eps):
                raise ValueError
            eps_values = sorted({float(value) for value in raw_eps})
            raw_min_samples = list(min_samples_candidates)
            if any(
                isinstance(value, bool) or int(value) != float(value)
                for value in raw_min_samples
            ):
                raise ValueError
            min_values = sorted({int(value) for value in raw_min_samples})
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValidationError("Kandidat epsilon dan min_samples tidak valid.") from exc

        if not eps_values or any(not np.isfinite(value) or value <= 0 for value in eps_values):
            raise ValidationError("Kandidat epsilon harus berisi angka positif dan finite.")
        if not min_values or any(value < 2 for value in min_values):
            raise ValidationError("Kandidat min_samples harus minimal 2.")

        eps_sources_by_km = eps_sources_by_km or {}
        if not isinstance(eps_sources_by_km, dict):
            raise ValidationError("eps_sources_by_km harus berupa objek mapping.")

        coordinates_deg = np.asarray(
            self.earthquakes.coordinates_for_dataset(dataset_id), dtype=np.float64
        )
        if coordinates_deg.ndim != 2 or coordinates_deg.shape[1] != 2:
            raise ValidationError("Koordinat dataset harus memiliki latitude dan longitude.")
        if len(coordinates_deg) < max(min_values):
            raise ValidationError("Jumlah titik lebih kecil daripada min_samples terbesar.")
        if not np.isfinite(coordinates_deg).all():
            raise ValidationError("Koordinat dataset mengandung nilai non-finite.")
        if np.any((coordinates_deg[:, 0] < -90) | (coordinates_deg[:, 0] > 90)):
            raise ValidationError("Latitude harus berada pada rentang -90 sampai 90 derajat.")
        if np.any((coordinates_deg[:, 1] < -180) | (coordinates_deg[:, 1] > 180)):
            raise ValidationError("Longitude harus berada pada rentang -180 sampai 180 derajat.")
        coordinates = np.radians(coordinates_deg)

        if job_id is not None:
            job = self.jobs.get(job_id)
            if job is None:
                raise NotFoundError("Processing job tidak ditemukan.")
            if job.dataset_id != dataset_id or job.job_type != "PARAMETER_SEARCH":
                raise ValidationError("Job tidak cocok dengan dataset atau jenis proses.")
            if job.status == "SUCCESS":
                return {"job": job, "experiments": self.experiments.list_for_job(job.id)}
            if job.status not in {
                "QUEUED", "RUNNING", "PAUSE_REQUESTED", "STOP_REQUESTED"
            }:
                raise ConflictError(f"Job tidak dapat dijalankan dari status {job.status}.")
            if job.status == "QUEUED":
                job.status = "RUNNING"
            if job.status not in {"RUNNING", "PAUSE_REQUESTED", "STOP_REQUESTED"}:
                raise ConflictError(f"Job tidak dapat berjalan dari status {job.status}.")
            job.celery_task_id = celery_task_id or job.celery_task_id
            job.progress = int(job.progress or 0)
            if job.status == "RUNNING":
                job.current_step = "PARAMETER_SEARCH"
                job.message = "Pencarian kandidat parameter DBSCAN sedang berjalan."
            job.started_at = job.started_at or utc_now()
        else:
            job = ProcessingJob(
                dataset_id=dataset_id,
                run_id=None,
                job_type="PARAMETER_SEARCH",
                celery_task_id=celery_task_id,
                status="RUNNING",
                progress=0,
                current_step="PARAMETER_SEARCH",
                message="Pencarian kandidat parameter DBSCAN dimulai.",
                created_by=created_by,
                started_at=utc_now(),
            )
            self.jobs.add(job)

        try:
            payload = dict(job.input_payload or {})
            search_metadata = dict(
                payload.get("parameter_search_metadata") or {}
            )
            search_metadata["validity_thresholds"] = dict(
                self.validity_thresholds
            )
            search_metadata["method_version"] = self.METHOD_VERSION
            payload["parameter_search_metadata"] = search_metadata
            job.input_payload = payload

            db.session.commit()
            combinations = [(eps, min_samples) for eps in eps_values for min_samples in min_values]
            existing_experiments = self.experiments.list_for_job(job.id)
            existing_keys = {
                (round(float(item.eps_km), 12), int(item.min_samples))
                for item in existing_experiments
            }
            created = list(existing_experiments)

            for index, (eps_km, min_samples) in enumerate(combinations, start=1):
                if checkpoint_callback is not None:
                    checkpoint_callback(
                        stage=f"BEFORE_COMBINATION_{index}",
                        progress=int((index - 1) / len(combinations) * 100),
                    )
                key = (round(float(eps_km), 12), int(min_samples))
                if key in existing_keys:
                    job.progress = max(int(job.progress or 0), int(index / len(combinations) * 100))
                    job.current_step = "PARAMETER_SEARCH"
                    db.session.commit()
                    if checkpoint_callback is not None:
                        checkpoint_callback(
                            stage=f"COMBINATION_{index}_ALREADY_COMPLETE",
                            progress=int(index / len(combinations) * 100),
                        )
                    continue
                # eps_km comes from the rounded candidate union; derive radians
                # from that exact persisted value to keep km/radian consistent.
                eps_radian = float(eps_km) / EARTH_RADIUS_KM
                labels = DBSCAN(
                    eps=eps_radian,
                    min_samples=min_samples,
                    metric="haversine",
                    algorithm="ball_tree",
                ).fit_predict(coordinates)

                cluster_labels = sorted(int(value) for value in set(labels) if value >= 0)
                cluster_sizes = [int(np.sum(labels == label)) for label in cluster_labels]
                cluster_count = len(cluster_labels)
                noise_count = int(np.sum(labels == -1))
                clustered_count = int(len(labels) - noise_count)
                evaluation = self.evaluator.evaluate(coordinates, labels)
                score = evaluation["silhouette_score"]
                sample_size = evaluation["silhouette_sample_size"]
                evaluation_metadata = dict(
                    evaluation.get("evaluation_metadata") or {}
                )

                # T6: validity is determined by configured clustering thresholds,
                # independently from whether Silhouette can be calculated.
                noise_percentage = evaluation_metadata.get("noise_percentage")
                largest_cluster_ratio = evaluation_metadata.get(
                    "largest_cluster_ratio"
                )

                is_valid, invalid_reasons = self._evaluate_validity(
                    cluster_count=cluster_count,
                    noise_percentage=noise_percentage,
                    largest_cluster_ratio=largest_cluster_ratio,
                    thresholds=self.validity_thresholds,
                )

                evaluation_metadata.update({
                    "is_valid": bool(is_valid),
                    "invalid_reasons": list(invalid_reasons),
                    "validity_thresholds": dict(self.validity_thresholds),
                })

                # Retain the legacy database field without changing its schema.
                invalid_reason = (
                    "; ".join(invalid_reasons) if invalid_reasons else None
                )
                source_key = self._epsilon_key(eps_km)
                raw_sources = eps_sources_by_km.get(source_key, ["direct_run_search"])
                if not isinstance(raw_sources, (list, tuple, set)):
                    raise ValidationError(
                        f"eps_sources untuk epsilon {eps_km:g} km harus berupa array."
                    )
                epsilon_sources = sorted({str(value) for value in raw_sources if str(value)})
                if not epsilon_sources:
                    epsilon_sources = ["direct_run_search"]
                evaluation_metadata["parameter_search"] = {
                    "method_version": self.METHOD_VERSION,
                    "eps_sources": epsilon_sources,
                    "epsilon_rounding_km": float(self.epsilon_rounding_km),
                    "rounding_km": float(self.epsilon_rounding_km),
                    "eps_radian": float(eps_radian),
                    "combination_mode": self.COMBINATION_MODE,
                }
                if epsilon_search_metadata:
                    evaluation_metadata["parameter_search"].update({
                        "epsilon_candidate_strategy": epsilon_search_metadata.get(
                            "epsilon_candidate_strategy"
                        ),
                        "use_default_grid": epsilon_search_metadata.get("use_default_grid"),
                        "rounding_km": epsilon_search_metadata.get("rounding_km"),
                    })
                experiment = DBSCANParameterExperiment(
                    dataset_id=dataset_id,
                    job_id=job.id,
                    eps_km=eps_km,
                    eps_radian=eps_radian,
                    min_samples=min_samples,
                    cluster_count=cluster_count,
                    noise_count=noise_count,
                    noise_percentage=noise_percentage,
                    clustered_count=clustered_count,
                    min_cluster_size=min(cluster_sizes) if cluster_sizes else None,
                    median_cluster_size=float(np.median(cluster_sizes)) if cluster_sizes else None,
                    max_cluster_size=max(cluster_sizes) if cluster_sizes else None,
                    silhouette_score=score,
                    silhouette_sample_size=sample_size,
                    dbcv_score=evaluation["dbcv_score"],
                    dbi_score=evaluation["dbi_score"],
                    evaluation_metadata=evaluation_metadata,
                    stability_score=None,
                    is_valid=is_valid,
                    invalid_reason=invalid_reason,
                    is_recommended=False,
                )
                self.experiments.add(experiment)
                created.append(experiment)

                job.progress = max(int(job.progress or 0), int(index / len(combinations) * 100))
                job.current_step = "PARAMETER_SEARCH"
                job.message = f"Menguji kombinasi {index}/{len(combinations)}."
                db.session.commit()
                if checkpoint_callback is not None:
                    checkpoint_callback(
                        stage=f"COMBINATION_{index}_COMPLETE",
                        progress=int(index / len(combinations) * 100),
                    )

            if job_id is not None:
                locked_job = self.jobs.get_for_update(job.id)
                if locked_job is None:
                    raise NotFoundError("Processing job tidak ditemukan.")
                db.session.refresh(locked_job, with_for_update=True)
                if locked_job.status in {"PAUSE_REQUESTED", "STOP_REQUESTED"}:
                    if checkpoint_callback is not None:
                        checkpoint_callback(
                            stage="ALL_COMBINATIONS_COMPLETE",
                            progress=99,
                        )
                    raise ConflictError(
                        f"Job lifecycle berubah menjadi {locked_job.status}."
                    )
                job = locked_job

            # T7: Post-processing stabilitas grid terhadap tetangga ortogonal
            self.calculate_grid_stability(created)

            # T8: Post-processing rekomendasi multikriteria
            self.calculate_multicriteria_recommendations(
                created,
                weights=self.recommendation_weights,
                job=job,
            )

            job.status = "SUCCESS"
            job.progress = 100
            job.finished_at = utc_now()
            job.message = f"Pencarian selesai: {len(created)} kombinasi diuji."
            db.session.commit()
            return {
                "job": job,
                "experiments": self.experiments.list_for_job(job.id),
            }
        except (JobPaused, JobCancelled):
            db.session.rollback()
            raise
        except Exception as exc:
            db.session.rollback()
            failed_job = self.jobs.get(job.id) if job.id else None
            if failed_job is not None:
                failed_job.status = "FAILED"
                failed_job.finished_at = utc_now()
                failed_job.error_code = "PARAMETER_SEARCH_FAILED"
                failed_job.error_detail = str(exc)[:4000]
                failed_job.message = "Pencarian parameter gagal."
                db.session.commit()
            raise
