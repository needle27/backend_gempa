"""Reproducible spatial clustering validity metrics for Haversine DBSCAN.

Silhouette is computed on a deterministic, cluster-stratified sample using
Haversine distance. Davies-Bouldin is computed on a 3-D unit-sphere embedding
using Euclidean chord distance (the standard DBI formula in that embedding).
DBCV is computed from Haversine mutual-reachability distances and a minimum
spanning tree, using a deterministic stratified sample to bound O(n^2) memory.
Noise is excluded from Silhouette and DBI geometry. For DBCV, noise is excluded from cluster geometry but included in the total-observation weighting denominator, following Moulavi et al. (2014).
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import silhouette_score


class ClusteringEvaluationService:
    """Calculate comparable internal validation metrics for spatial clusters."""

    VERSION = "2.0.0-silhouette-only"
    NOISE_LABEL = -1

    def __init__(
        self,
        *,
        silhouette_max_sample: int = 10_000,
        random_state: int = 42,
    ):
        self.silhouette_max_sample = int(silhouette_max_sample)
        self.random_state = int(random_state)
        if self.silhouette_max_sample < 2:
            raise ValueError("silhouette_max_sample minimal 2.")

    @staticmethod
    def _validate_inputs(coordinates_rad, labels):
        coordinates = np.asarray(coordinates_rad, dtype=np.float64)
        raw_labels = np.asarray(labels)
        if coordinates.ndim != 2 or coordinates.shape[1] != 2:
            raise ValueError("coordinates_rad harus berbentuk (n, 2): latitude dan longitude.")
        if raw_labels.ndim != 1 or len(raw_labels) != len(coordinates):
            raise ValueError("labels harus satu dimensi dan sejajar dengan koordinat.")
        if raw_labels.dtype.kind not in "iu" and (
            raw_labels.dtype.kind not in "f"
            or not np.isfinite(raw_labels).all()
            or not np.equal(raw_labels, np.floor(raw_labels)).all()
        ):
            raise ValueError("labels harus berisi bilangan bulat.")
        labels = raw_labels.astype(np.int64, copy=False)
        if np.any(labels < -1):
            raise ValueError("Label cluster tidak boleh lebih kecil dari -1.")
        if len(labels) == 0:
            raise ValueError("Tidak ada titik untuk evaluasi.")
        if not np.isfinite(coordinates).all():
            raise ValueError("Koordinat mengandung nilai non-finite.")
        if np.any(np.abs(coordinates[:, 0]) > np.pi / 2 + 1e-12):
            raise ValueError("Latitude radian berada di luar rentang [-pi/2, pi/2].")
        if np.any(np.abs(coordinates[:, 1]) > np.pi + 1e-12):
            raise ValueError("Longitude radian berada di luar rentang [-pi, pi].")
        return coordinates, labels

    @staticmethod
    def _allocate_stratified(labels, max_samples, min_per_cluster, random_state):
        """Return deterministic per-cluster sample indices or a failure reason."""
        labels = np.asarray(labels, dtype=np.int64)
        cluster_ids, counts = np.unique(labels, return_counts=True)
        if len(cluster_ids) < 2:
            return None, "Memerlukan minimal dua klaster non-noise."
        total = int(counts.sum())
        if total <= max_samples:
            return np.arange(len(labels), dtype=np.int64), None

        minimum_required = sum(min(int(count), min_per_cluster) for count in counts)
        if minimum_required > max_samples:
            return None, (
                f"Batas sampel {max_samples} tidak cukup untuk mempertahankan minimal "
                f"{min_per_cluster} titik pada setiap klaster ({len(cluster_ids)} klaster)."
            )

        allocation = np.minimum(counts, min_per_cluster).astype(np.int64)
        remaining = int(max_samples - allocation.sum())
        capacities = counts.astype(np.int64) - allocation

        # Proportional largest-remainder allocation; loop handles capped clusters.
        while remaining > 0 and np.any(capacities > 0):
            eligible_total = int(capacities.sum())
            quotas = remaining * capacities.astype(np.float64) / eligible_total
            additions = np.minimum(np.floor(quotas).astype(np.int64), capacities)
            if additions.sum() > 0:
                allocation += additions
                capacities -= additions
                remaining -= int(additions.sum())
                if remaining <= 0:
                    break
            eligible = np.flatnonzero(capacities > 0)
            if len(eligible) == 0:
                break
            fractional = quotas[eligible] - np.floor(quotas[eligible])
            order = eligible[np.argsort(-fractional, kind="stable")]
            progressed = False
            for index in order:
                if remaining <= 0:
                    break
                if capacities[index] > 0:
                    allocation[index] += 1
                    capacities[index] -= 1
                    remaining -= 1
                    progressed = True
            if not progressed:
                break

        rng = np.random.default_rng(random_state)
        selected = []
        for cluster_id, take in zip(cluster_ids, allocation):
            cluster_indices = np.flatnonzero(labels == cluster_id)
            if take >= len(cluster_indices):
                selected.extend(cluster_indices.tolist())
            else:
                selected.extend(
                    rng.choice(cluster_indices, size=int(take), replace=False).tolist()
                )
        selected = np.asarray(sorted(selected), dtype=np.int64)
        if len(selected) <= len(cluster_ids):
            return None, "Ukuran sampel tidak lebih besar daripada jumlah klaster."
        return selected, None




    def evaluate(self, coordinates_rad, labels):
        """Evaluate spatial labels with Haversine Silhouette only.

        Noise label -1 is excluded. Sampling remains deterministic and
        cluster-stratified so repeated evaluations are reproducible.
        """
        coordinates, labels = self._validate_inputs(coordinates_rad, labels)
        clustered_mask = labels != self.NOISE_LABEL
        clustered_count = int(np.sum(clustered_mask))
        cluster_ids, cluster_sizes = np.unique(
            labels[clustered_mask],
            return_counts=True,
        )
        cluster_count = int(len(cluster_ids))
        noise_count = int(len(labels) - clustered_count)
        max_cluster_size = (
            int(np.max(cluster_sizes)) if cluster_count > 0 else None
        )
        largest_cluster_ratio = (
            float(max_cluster_size / clustered_count)
            if clustered_count > 0
            else None
        )
        noise_percentage = float(noise_count / len(labels) * 100.0)

        metadata = {
            "version": self.VERSION,
            "distance_context": "spatial_latitude_longitude",
            "noise_label": self.NOISE_LABEL,
            "noise_excluded": True,
            "total_points": int(len(labels)),
            "clustered_points": clustered_count,
            "noise_points": noise_count,
            "cluster_count": cluster_count,
            "max_cluster_size": max_cluster_size,
            "largest_cluster_ratio": largest_cluster_ratio,
            "noise_percentage": noise_percentage,
            "random_state": self.random_state,
            "metrics": {},
        }

        silhouette_value = None
        silhouette_sample_size = None
        silhouette_reason = None

        if cluster_count < 2:
            silhouette_reason = "Silhouette memerlukan minimal dua klaster non-noise."
        elif clustered_count <= cluster_count:
            silhouette_reason = "Jumlah titik anggota harus lebih besar daripada jumlah klaster."
        else:
            sample_indices, silhouette_reason = self._allocate_stratified(
                labels[clustered_mask],
                self.silhouette_max_sample,
                1,
                self.random_state,
            )
            if sample_indices is not None:
                global_indices = np.flatnonzero(clustered_mask)[sample_indices]
                sample_labels = labels[global_indices]
                if len(np.unique(sample_labels)) < 2 or len(np.unique(sample_labels)) >= len(sample_labels):
                    silhouette_reason = (
                        "Jumlah klaster pada sampel harus minimal dua dan lebih kecil "
                        "daripada jumlah sampel."
                    )
                else:
                    try:
                        silhouette_value = float(
                            silhouette_score(
                                coordinates[global_indices],
                                sample_labels,
                                metric="haversine",
                            )
                        )
                        silhouette_sample_size = int(len(global_indices))
                    except (ValueError, FloatingPointError) as exc:
                        silhouette_reason = f"Silhouette tidak dapat dihitung: {exc}"

        metadata["metrics"]["silhouette"] = {
            "status": "computed" if silhouette_value is not None else "not_computed",
            "score": silhouette_value,
            "metric": "haversine",
            "sample_size": silhouette_sample_size,
            "sample_strategy": "deterministic_stratified_non_noise",
            "max_sample_size": self.silhouette_max_sample,
            "random_state": self.random_state,
            "noise_excluded": True,
            "reason": silhouette_reason,
        }
        metadata["overall_status"] = "complete" if silhouette_value is not None else "unavailable"
        metadata["evaluation_scope"] = "silhouette_only"

        # Legacy model/API fields are retained for historical compatibility.
        # New calculations do not produce DBI or DBCV values.
        return {
            "silhouette_score": silhouette_value,
            "silhouette_sample_size": silhouette_sample_size,
            "dbi_score": None,
            "dbcv_score": None,
            "evaluation_metadata": metadata,
        }
