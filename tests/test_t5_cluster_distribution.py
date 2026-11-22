import numpy as np
import pytest

from services.clustering_evaluation_service import ClusteringEvaluationService


@pytest.fixture
def evaluator():
    return ClusteringEvaluationService()


def test_largest_cluster_ratio_and_noise_percentage(evaluator):
    coordinates = np.radians(np.array([
        [-7.0, 110.0],
        [-7.1, 110.1],
        [-8.0, 111.0],
        [-8.1, 111.1],
        [-9.0, 112.0],
    ]))

    labels = np.array([0, 0, 1, 1, -1])

    result = evaluator.evaluate(coordinates, labels)
    metadata = result["evaluation_metadata"]

    assert metadata["max_cluster_size"] == 2
    assert metadata["largest_cluster_ratio"] == pytest.approx(0.5)
    assert metadata["noise_percentage"] == pytest.approx(20.0)


def test_all_noise_has_null_largest_cluster_ratio(evaluator):
    coordinates = np.radians(np.array([
        [-7.0, 110.0],
        [-8.0, 111.0],
        [-9.0, 112.0],
    ]))

    labels = np.array([-1, -1, -1])

    result = evaluator.evaluate(coordinates, labels)
    metadata = result["evaluation_metadata"]

    assert metadata["max_cluster_size"] is None
    assert metadata["largest_cluster_ratio"] is None
    assert metadata["noise_percentage"] == pytest.approx(100.0)


def test_no_noise_has_zero_noise_percentage(evaluator):
    coordinates = np.radians(np.array([
        [-7.0, 110.0],
        [-7.1, 110.1],
        [-8.0, 111.0],
        [-8.1, 111.1],
    ]))

    labels = np.array([0, 0, 1, 1])

    result = evaluator.evaluate(coordinates, labels)
    metadata = result["evaluation_metadata"]

    assert metadata["max_cluster_size"] == 2
    assert metadata["largest_cluster_ratio"] == pytest.approx(0.5)
    assert metadata["noise_percentage"] == pytest.approx(0.0)
