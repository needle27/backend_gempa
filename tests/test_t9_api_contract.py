"""Unit & Integration tests for Task T9 - Additive API Contract and Historical Compatibility."""

import pytest
from flask import Flask
from flask_jwt_extended import create_access_token

from extensions import db, jwt
import models  # noqa: F401
from models.dataset import DatasetInfo
from models.experiment import DBSCANParameterExperiment
from models.job import ProcessingJob
from models.run import DBSCANRun
from models.user import User
from routes.admin_jobs import admin_jobs_bp, serialize_experiment
from routes.admin_support import admin_support_bp


@pytest.fixture()
def t9_app(tmp_path):
    app = Flask("t9-api-contract-tests")
    app.config.update(
        TESTING=True,
        SECRET_KEY="test-t9-secret-key",
        JWT_SECRET_KEY="test-t9-jwt-secret-key-2026-very-secure-length-at-least-32-bytes",
        JWT_TOKEN_LOCATION=["headers"],
        JWT_COOKIE_CSRF_PROTECT=False,
        SQLALCHEMY_DATABASE_URI="sqlite+pysqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_DIR=str(tmp_path / "uploads"),
        ARTIFACT_DIR=str(tmp_path / "artifacts"),
    )
    db.init_app(app)
    jwt.init_app(app)
    app.register_blueprint(admin_jobs_bp)
    app.register_blueprint(admin_support_bp)

    with app.app_context():
        db.create_all()
        admin_user = User(
            email="admin.t9@example.invalid",
            username="admin-t9",
            password_hash="mock-hash",
            role="admin",
            is_active=True,
        )
        db.session.add(admin_user)
        db.session.commit()
        token = create_access_token(identity=str(admin_user.id))
        admin_id = admin_user.id

    client = app.test_client()
    headers = {"Authorization": f"Bearer {token}"}
    yield app, client, headers, admin_id

    with app.app_context():
        db.session.remove()
        db.drop_all()


def _create_dataset(user_id):
    from datetime import date
    dataset = DatasetInfo(
        dataset_name="Dataset T9 Test",
        source_name="BMKG",
        source_url="https://bmkg.go.id",
        original_filename="gempa_t9.csv",
        storage_path="var/uploads/gempa_t9.csv",
        file_hash_sha256="0" * 64,
        start_date=date(2021, 1, 1),
        end_date=date(2021, 1, 2),
        latitude_min=-7.0,
        latitude_max=-6.0,
        longitude_min=106.0,
        longitude_max=107.0,
        raw_row_count=1000,
        cleaned_row_count=1000,
        rejected_row_count=0,
        preprocessing_version="4.1.4",
        status="PROCESSED",
        uploaded_by=user_id,
    )
    db.session.add(dataset)
    db.session.commit()
    return dataset


class TestT9ExperimentSerialization:
    """Test unit serialize_experiment for both modern and historical experiment objects."""

    def test_serialize_modern_valid_experiment(self):
        class MockExp:
            id = 101
            dataset_id = 1
            job_id = 50
            eps_km = 20.0
            eps_radian = 20.0 / 6371.0088
            min_samples = 15
            cluster_count = 10
            noise_count = 100
            noise_percentage = 10.0
            clustered_count = 900
            min_cluster_size = 5
            median_cluster_size = 50.0
            max_cluster_size = 200
            silhouette_score = 0.55
            silhouette_sample_size = 900
            dbi_score = 1.1
            dbcv_score = 0.45
            is_valid = True
            invalid_reason = None
            is_recommended = True
            stability_score = 0.88
            evaluation_metadata = {
                "largest_cluster_ratio": 0.222,
                "invalid_reasons": [],  # T6+ valid experiment has empty list
                "recommendation_score": 0.912,
                "parameter_search": {
                    "eps_sources": ["k_distance_knee", "default_grid"]
                },
                "stability_score": 0.88,
            }

        data = serialize_experiment(MockExp())
        # All legacy fields preserved:
        assert data["id"] == 101
        assert data["eps_km"] == 20.0
        assert data["cluster_count"] == 10
        assert data["silhouette_score"] == 0.55
        assert data["dbi_score"] == 1.1
        assert data["dbcv_score"] == 0.45
        assert data["is_valid"] is True
        assert data["is_recommended"] is True

        # All additive T9 fields present:
        assert data["largest_cluster_ratio"] == pytest.approx(0.222, abs=1e-4)
        assert data["invalid_reasons"] == []
        assert data["stability_score"] == 0.88
        assert data["recommendation_score"] == pytest.approx(0.912, abs=1e-4)
        assert data["eps_sources"] == ["k_distance_knee", "default_grid"]

    def test_serialize_modern_invalid_experiment(self):
        class MockExp:
            id = 102
            dataset_id = 1
            job_id = 50
            eps_km = 5.0
            eps_radian = 5.0 / 6371.0088
            min_samples = 30
            cluster_count = 1
            noise_count = 600
            noise_percentage = 60.0
            clustered_count = 400
            min_cluster_size = 400
            median_cluster_size = 400.0
            max_cluster_size = 400
            silhouette_score = None
            silhouette_sample_size = None
            dbi_score = None
            dbcv_score = None
            is_valid = False
            invalid_reason = "min_clusters_not_met; noise_percentage_exceeds_max"
            is_recommended = False
            stability_score = None
            evaluation_metadata = {
                "largest_cluster_ratio": 1.0,
                "invalid_reasons": [
                    "min_clusters_not_met (1 < 2)",
                    "noise_percentage_exceeds_max (60.0% > 40.0%)",
                ],
                "recommendation_score": None,
                "eps_sources": ["default_grid"],
            }

        data = serialize_experiment(MockExp())
        assert data["is_valid"] is False
        assert data["is_recommended"] is False
        assert data["largest_cluster_ratio"] == 1.0
        assert data["invalid_reasons"] == [
            "min_clusters_not_met (1 < 2)",
            "noise_percentage_exceeds_max (60.0% > 40.0%)",
        ]
        assert data["recommendation_score"] is None
        assert data["stability_score"] is None
        assert data["eps_sources"] == ["default_grid"]

    def test_serialize_historical_experiment_graceful_fallbacks(self):
        """Simulate pre-T6 historical record: no invalid_reasons key, no stability/recommendation."""
        class MockHistoricalExp:
            id = 5
            dataset_id = 1
            job_id = 10
            eps_km = 30.0
            eps_radian = 30.0 / 6371.0088
            min_samples = 10
            cluster_count = 15
            noise_count = 200
            noise_percentage = 20.0
            clustered_count = 800
            min_cluster_size = 10
            median_cluster_size = 40.0
            max_cluster_size = 160
            silhouette_score = 0.42
            silhouette_sample_size = 800
            dbi_score = None
            dbcv_score = None
            is_valid = True
            invalid_reason = None
            is_recommended = True
            stability_score = None
            # Historical metadata has NO T6/T7/T8 keys:
            evaluation_metadata = {"silhouette_sample_size": 800}

        data = serialize_experiment(MockHistoricalExp())
        assert data["id"] == 5
        # Fallback ratio computed from max_cluster_size / clustered_count: 160 / 800 = 0.2
        assert data["largest_cluster_ratio"] == pytest.approx(0.2, abs=1e-4)
        # invalid_reasons is None for historical records where key never existed
        assert data["invalid_reasons"] is None
        assert data["stability_score"] is None
        assert data["recommendation_score"] is None
        assert data["eps_sources"] is None

    def test_serialize_none_experiment(self):
        assert serialize_experiment(None) is None


class TestT9ApiEndpoints:
    """Test HTTP API responses for Job detail and Experiment list."""

    def test_job_detail_modern_with_aliases_and_knee_summary(self, t9_app):
        app, client, headers, user_id = t9_app
        with app.app_context():
            dataset = _create_dataset(user_id)
            search_metadata = {
                "default_grid_km": [10.0, 15.0, 20.0],
                "rounding_km": 0.5,
                "knee_not_found": [20, 25],
                "validity_thresholds": {
                    "min_clusters": 2,
                    "max_clusters": 80,
                    "max_noise_percentage": 40.0,
                    "max_largest_cluster_ratio": 0.5,
                },
                "knee_summary": [
                    {
                        "min_samples": 10,
                        "knee_eps_km": 18.5,
                        "p90_km": 15.0,
                        "p95_km": 18.0,
                        "p98_km": 22.0,
                        "detected": True,
                        "status": "DETECTED",
                    },
                    {
                        "min_samples": 20,
                        "knee_eps_km": None,
                        "p90_km": 20.0,
                        "p95_km": 24.0,
                        "p98_km": 29.0,
                        "detected": False,
                        "status": "NOT_DETECTED",
                    },
                ],
                "recommendation_status": "RECOMMENDED",
                "recommendation_weights": {
                    "silhouette": 0.4,
                    "noise_percentage": 0.2,
                    "largest_cluster_ratio": 0.2,
                    "stability_score": 0.2,
                },
                "selected_experiment": {
                    "id": 88,
                    "eps_km": 18.5,
                    "min_samples": 10,
                    "recommendation_score": 0.895,
                    "silhouette_score": 0.52,
                },
            }
            job = ProcessingJob(
                dataset_id=dataset.id,
                job_type="PARAMETER_SEARCH",
                status="SUCCESS",
                progress=100,
                current_step="COMPLETED",
                created_by=user_id,
                input_payload={"parameter_search_metadata": search_metadata},
            )
            db.session.add(job)
            db.session.commit()
            job_id = job.id

        resp = client.get(f"/api/admin/jobs/{job_id}", headers=headers)
        assert resp.status_code == 200
        payload = resp.get_json()
        data = payload["data"]

        # Dual alias canonical normalization:
        meta = data["parameter_search_metadata"]
        assert meta["default_grid_km"] == [10.0, 15.0, 20.0]
        assert meta["default_grid"] == [10.0, 15.0, 20.0]
        assert meta["epsilon_rounding_km"] == 0.5
        assert meta["rounding_km"] == 0.5
        assert meta["knee_not_detected_min_samples"] == [20, 25]
        assert meta["knee_not_found"] == [20, 25]

        # Additive T9 top-level job fields:
        assert data["knee_summary"] == search_metadata["knee_summary"]
        assert data["validity_thresholds"]["min_clusters"] == 2
        assert data["validity_thresholds"]["max_largest_cluster_ratio"] == 0.5
        assert data["recommendation_status"] == "RECOMMENDED"
        assert data["recommendation_weights"]["silhouette"] == 0.4
        assert data["selected_experiment"]["id"] == 88

    def test_job_detail_historical_compatibility(self, t9_app):
        """Historical job without parameter_search_metadata returns None for new fields, 0 error."""
        app, client, headers, user_id = t9_app
        with app.app_context():
            dataset = _create_dataset(user_id)
            job = ProcessingJob(
                dataset_id=dataset.id,
                job_type="PARAMETER_SEARCH",
                status="SUCCESS",
                progress=100,
                current_step="COMPLETED",
                created_by=user_id,
                input_payload={"old_key": "some_value"},
            )
            db.session.add(job)
            db.session.commit()
            job_id = job.id

        resp = client.get(f"/api/admin/jobs/{job_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]

        assert data["id"] == job_id
        assert data["knee_summary"] is None
        assert data["validity_thresholds"] is None
        assert data["recommendation_status"] is None
        assert data["recommendation_weights"] is None
        assert data["selected_experiment"] is None
        assert data["parameter_search_metadata"] is None

    def test_experiments_endpoint_returns_t9_fields(self, t9_app):
        app, client, headers, user_id = t9_app
        with app.app_context():
            dataset = _create_dataset(user_id)
            job = ProcessingJob(
                dataset_id=dataset.id,
                job_type="PARAMETER_SEARCH",
                status="SUCCESS",
                progress=100,
                created_by=user_id,
            )
            db.session.add(job)
            db.session.flush()

            exp_valid = DBSCANParameterExperiment(
                dataset_id=dataset.id,
                job_id=job.id,
                eps_km=15.0,
                eps_radian=15.0 / 6371.0088,
                min_samples=10,
                cluster_count=8,
                noise_count=50,
                noise_percentage=5.0,
                clustered_count=950,
                min_cluster_size=10,
                median_cluster_size=60.0,
                max_cluster_size=180,
                silhouette_score=0.61,
                silhouette_sample_size=950,
                stability_score=0.85,
                is_valid=True,
                is_recommended=True,
                evaluation_metadata={
                    "largest_cluster_ratio": 0.189,
                    "invalid_reasons": [],
                    "recommendation_score": 0.94,
                    "parameter_search": {"eps_sources": ["k_distance_knee"]},
                },
            )
            exp_invalid = DBSCANParameterExperiment(
                dataset_id=dataset.id,
                job_id=job.id,
                eps_km=40.0,
                eps_radian=40.0 / 6371.0088,
                min_samples=5,
                cluster_count=1,
                noise_count=20,
                noise_percentage=2.0,
                clustered_count=980,
                min_cluster_size=980,
                median_cluster_size=980.0,
                max_cluster_size=980,
                silhouette_score=None,
                stability_score=None,
                is_valid=False,
                invalid_reason="min_clusters_not_met; largest_cluster_ratio_exceeds_max",
                is_recommended=False,
                evaluation_metadata={
                    "largest_cluster_ratio": 1.0,
                    "invalid_reasons": [
                        "min_clusters_not_met (1 < 2)",
                        "largest_cluster_ratio_exceeds_max (1.000 > 0.500)",
                    ],
                    "recommendation_score": None,
                    "parameter_search": {"eps_sources": ["default_grid"]},
                },
            )
            db.session.add_all([exp_valid, exp_invalid])
            db.session.commit()
            job_id = job.id

        resp = client.get(f"/api/admin/jobs/{job_id}/experiments", headers=headers)
        assert resp.status_code == 200
        items = resp.get_json()["data"]
        assert len(items) == 2

        valid_item = next(it for it in items if it["is_valid"] is True)
        assert valid_item["is_recommended"] is True
        assert valid_item["largest_cluster_ratio"] == pytest.approx(0.189, abs=1e-4)
        assert valid_item["invalid_reasons"] == []
        assert valid_item["stability_score"] == 0.85
        assert valid_item["recommendation_score"] == pytest.approx(0.94, abs=1e-4)
        assert valid_item["eps_sources"] == ["k_distance_knee"]

        invalid_item = next(it for it in items if it["is_valid"] is False)
        assert invalid_item["is_recommended"] is False
        assert invalid_item["largest_cluster_ratio"] == 1.0
        assert len(invalid_item["invalid_reasons"]) == 2
        assert invalid_item["stability_score"] is None
        assert invalid_item["recommendation_score"] is None
        assert invalid_item["eps_sources"] == ["default_grid"]

    def test_no_valid_experiment_job_response(self, t9_app):
        """When grid search produces no valid candidate, status is NO_VALID_EXPERIMENT."""
        app, client, headers, user_id = t9_app
        with app.app_context():
            dataset = _create_dataset(user_id)
            search_metadata = {
                "default_grid": [5.0],
                "rounding_km": 0.5,
                "recommendation_status": "NO_VALID_EXPERIMENT",
                "recommendation_weights": {
                    "silhouette": 0.4,
                    "noise_percentage": 0.2,
                    "largest_cluster_ratio": 0.2,
                    "stability_score": 0.2,
                },
                "selected_experiment": None,
            }
            job = ProcessingJob(
                dataset_id=dataset.id,
                job_type="PARAMETER_SEARCH",
                status="SUCCESS",
                progress=100,
                created_by=user_id,
                input_payload={"parameter_search_metadata": search_metadata},
            )
            db.session.add(job)
            db.session.commit()
            job_id = job.id

        resp = client.get(f"/api/admin/jobs/{job_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]

        assert data["recommendation_status"] == "NO_VALID_EXPERIMENT"
        assert data["selected_experiment"] is None
        assert data["recommendation_weights"] is not None
