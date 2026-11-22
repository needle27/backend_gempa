import numpy as np
import pytest

from services.parameter_search_service import ParameterSearchService


class _DatasetRepo:
    def get(self, dataset_id):
        return object()


class _EarthquakeRepo:
    def coordinates_for_dataset(self, dataset_id):
        return [
            (-6.2000, 106.8000),
            (-6.2005, 106.8005),
            (-6.1995, 106.7995),
            (-7.0000, 107.0000),
            (-7.0005, 107.0005),
            (-6.9995, 106.9995),
        ]


def test_calculate_k_distances_returns_each_candidate_from_shared_query(app):
    with app.app_context():
        service = ParameterSearchService(
            dataset_repository=_DatasetRepo(),
            earthquake_repository=_EarthquakeRepo(),
        )
        curves = service.calculate_k_distances(
            dataset_id=1,
            min_samples_candidates=[2, 3],
        )
        assert [item["min_samples"] for item in curves] == [2, 3]
        assert all(len(item["k_distance_km"]) == 6 for item in curves)
        assert all(item["metric"] == "haversine" for item in curves)
        assert all(np.all(np.diff(item["k_distance_km"]) >= 0) for item in curves)
        assert all(item["earth_radius_km"] > 0 for item in curves)


def test_calculate_k_distances_rejects_candidate_above_dataset_size(app):
    from services.exceptions import ValidationError
    import pytest
    with app.app_context():
        service = ParameterSearchService(
            dataset_repository=_DatasetRepo(),
            earthquake_repository=_EarthquakeRepo(),
        )
        with pytest.raises(ValidationError):
            service.calculate_k_distances(
                dataset_id=1,
                min_samples_candidates=[7],
            )



def test_knee_locator_uses_p95_prefix_and_reports_full_curve_percentiles(app, monkeypatch):
    captured = {}

    class _KneeLocatorStub:
        def __init__(self, x_values, y_values, **kwargs):
            captured["x"] = np.asarray(x_values)
            captured["y"] = np.asarray(y_values)
            captured["kwargs"] = kwargs
            self.knee = 40

    class _LargeEarthquakeRepo:
        def coordinates_for_dataset(self, dataset_id):
            return [
                (-10.0 + index * 0.0001, 110.0 + index * 0.0001)
                for index in range(100)
            ]

    monkeypatch.setattr(
        "services.parameter_search_service.KneeLocator", _KneeLocatorStub
    )
    with app.app_context():
        service = ParameterSearchService(
            dataset_repository=_DatasetRepo(),
            earthquake_repository=_LargeEarthquakeRepo(),
        )
        curve = service.calculate_k_distances(
            dataset_id=1,
            min_samples_candidates=[2],
        )[0]

    full_curve = curve["k_distance_km"]
    assert curve["point_count"] == 100
    assert curve["knee_input_cutoff"] == "p95"
    assert curve["knee_input_point_count"] == 95
    assert len(captured["x"]) == 95
    assert captured["x"][0] == 1
    assert captured["x"][-1] == 95
    np.testing.assert_allclose(captured["y"], full_curve[:95])
    assert captured["kwargs"] == {"curve": "convex", "direction": "increasing"}

    # KneeLocator returns a 1-based rank from the truncated input; the epsilon
    # is looked up at the same rank in the unchanged full curve.
    assert curve["knee_index"] == 40
    assert curve["eps_knee_km"] == pytest.approx(full_curve[39])
    assert curve["epsilon_km"] == pytest.approx(curve["eps_knee_km"])
    assert curve["method_version"] == "4.1.4"

    expected_percentiles = np.percentile(full_curve, [90, 95, 98])
    assert curve["k_distance_percentiles_km"]["p90"] == pytest.approx(expected_percentiles[0])
    assert curve["k_distance_percentiles_km"]["p95"] == pytest.approx(expected_percentiles[1])
    assert curve["k_distance_percentiles_km"]["p98"] == pytest.approx(expected_percentiles[2])


def test_elbow_json_persists_p95_cutoff_and_percentiles(app, tmp_path, monkeypatch):
    import json
    from types import SimpleNamespace

    import services.elbow_artifact_service as elbow_module

    class _ArtifactRepositoryStub:
        def list_for_job(self, job_id):
            return []

    class _ArtifactServiceStub:
        def register_file(self, **kwargs):
            return None

    def _write_plot(path, *args, **kwargs):
        path.write_bytes(b"test-image")

    monkeypatch.setattr(elbow_module, "ArtifactRepository", _ArtifactRepositoryStub)
    monkeypatch.setattr(
        elbow_module.ElbowArtifactService, "_plot_curve", staticmethod(_write_plot)
    )
    monkeypatch.setattr(
        elbow_module.ElbowArtifactService,
        "_plot_comparison",
        staticmethod(_write_plot),
    )

    curve = {
        "min_samples": 8,
        "k_distance_km": np.linspace(1.0, 10.0, 100).tolist(),
        "k_distance_percentiles_km": {"p90": 9.1, "p95": 9.55, "p98": 9.82},
        "percentile_method": "linear",
        "knee_input_cutoff": "p95",
        "knee_input_point_count": 95,
        "knee_index": 40,
        "knee_detected": True,
        "eps_knee_km": 4.5454545455,
        "epsilon_km": 4.5454545455,
        "epsilon_radian": 4.5454545455 / 6371.0088,
        "method_version": "4.1.1",
    }

    with app.app_context():
        service = elbow_module.ElbowArtifactService(
            artifact_root=tmp_path,
            artifact_service=_ArtifactServiceStub(),
        )
        search_context = {
            "method_version": "4.1.4",
            "combination_mode": "cross",
            "epsilon_candidate_strategy": "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID",
            "epsilon_rounding_km": 0.5,
            "epsilon_candidates": [
                {"eps_km": 10.0, "eps_sources": ["grid"]},
                {"eps_km": 20.0, "eps_sources": ["explicit", "grid"]},
            ],
        }
        service.save_job_artifacts(
            dataset=SimpleNamespace(
                id=1,
                file_hash_sha256="test-hash",
                preprocessing_version="test-preprocessing-v1",
            ),
            job=SimpleNamespace(id=99),
            curves=[curve],
            search_context=search_context,
        )

    json_path = next(tmp_path.rglob("minpts_8.json"))
    metadata = json.loads(json_path.read_text(encoding="utf-8"))
    assert metadata["method_version"] == "4.1.1"
    assert metadata["k_distance_percentiles_km"] == curve["k_distance_percentiles_km"]
    assert metadata["knee_input_cutoff"] == "p95"
    assert metadata["knee_input_point_count"] == 95
    assert metadata["knee_index"] == 40
    assert metadata["eps_knee_km"] == pytest.approx(curve["eps_knee_km"])
    assert metadata["knee_detection"]["input_cutoff"] == "p95"
    assert metadata["search_configuration"] == search_context


def test_knee_locator_exception_isolated_to_affected_minpts(app, monkeypatch):
    call_count = {"value": 0}

    class _SelectiveKneeLocatorStub:
        def __init__(self, x_values, y_values, **kwargs):
            call_count["value"] += 1
            if call_count["value"] == 2:
                raise ValueError("synthetic knee failure")
            self.knee = 40

    class _LargeEarthquakeRepo:
        def coordinates_for_dataset(self, dataset_id):
            return [
                (-10.0 + index * 0.0001, 110.0 + index * 0.0001)
                for index in range(100)
            ]

    monkeypatch.setattr(
        "services.parameter_search_service.KneeLocator",
        _SelectiveKneeLocatorStub,
    )
    with app.app_context():
        service = ParameterSearchService(
            dataset_repository=_DatasetRepo(),
            earthquake_repository=_LargeEarthquakeRepo(),
        )
        curves = service.calculate_k_distances(
            dataset_id=1,
            min_samples_candidates=[2, 3],
        )

    assert curves[0]["knee_detected"] is True
    assert curves[0]["knee_detection_error"] is None
    assert curves[1]["knee_detected"] is False
    assert curves[1]["eps_knee_km"] is None
    assert curves[1]["knee_detection_error"] == "ValueError: synthetic knee failure"
