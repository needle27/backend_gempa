"""Tests for the research evaluation metric: Haversine Silhouette only."""

import numpy as np
import pytest

from services.clustering_evaluation_service import ClusteringEvaluationService


def _two_spatial_clusters():
    rng = np.random.default_rng(2026)
    first = np.column_stack((rng.normal(-0.25, 0.002, 18), rng.normal(2.0, 0.002, 18)))
    second = np.column_stack((rng.normal(0.25, 0.002, 18), rng.normal(2.5, 0.002, 18)))
    noise = np.array([[0.0, 0.0]])
    coordinates = np.vstack((first, second, noise))
    labels = np.array([0] * len(first) + [1] * len(second) + [-1])
    return coordinates, labels


def test_haversine_silhouette_is_computed_and_noise_is_excluded():
    coordinates, labels = _two_spatial_clusters()
    result = ClusteringEvaluationService(silhouette_max_sample=30, random_state=42).evaluate(coordinates, labels)
    assert result["silhouette_score"] is not None
    assert -1 <= result["silhouette_score"] <= 1
    assert result["dbi_score"] is None
    assert result["dbcv_score"] is None
    metadata = result["evaluation_metadata"]
    assert metadata["noise_points"] == 1
    assert metadata["clustered_points"] == 36
    assert metadata["noise_excluded"] is True
    assert set(metadata["metrics"]) == {"silhouette"}
    assert metadata["overall_status"] == "complete"
    assert metadata["evaluation_scope"] == "silhouette_only"


def test_silhouette_sampling_is_deterministic():
    coordinates, labels = _two_spatial_clusters()
    service = ClusteringEvaluationService(silhouette_max_sample=20, random_state=7)
    first = service.evaluate(coordinates, labels)
    second = service.evaluate(coordinates, labels)
    assert first["silhouette_score"] == pytest.approx(second["silhouette_score"])
    assert first["evaluation_metadata"]["metrics"]["silhouette"]["sample_size"] == 20
    assert first["dbi_score"] is None and first["dbcv_score"] is None


def test_silhouette_is_unavailable_with_one_cluster():
    coordinates = np.array([[0.1, 1.0], [0.1001, 1.0], [0.1002, 1.0]])
    labels = np.array([0, 0, 0])
    result = ClusteringEvaluationService().evaluate(coordinates, labels)
    assert result["silhouette_score"] is None
    assert result["evaluation_metadata"]["metrics"]["silhouette"]["status"] == "not_computed"


def test_input_validation_rejects_invalid_latitude_radians():
    coordinates = np.array([[2.0, 0.0], [0.1, 1.0]])
    labels = np.array([0, 1])
    with pytest.raises(ValueError, match="Latitude radian"):
        ClusteringEvaluationService().evaluate(coordinates, labels)
