"""Integration tests for validation, detail, and audit-log admin APIs."""
from datetime import date, datetime, timezone
from io import BytesIO

import pytest
from flask import Flask
from flask_jwt_extended import create_access_token

from extensions import db, jwt
import models  # noqa: F401
from models.audit_log import AuditLog
from models.dataset import DatasetInfo
from models.experiment import DBSCANParameterExperiment
from models.job import ProcessingJob
from models.run import DBSCANRun
from models.user import User
from routes.admin_support import admin_support_bp


@pytest.fixture()
def api_client(tmp_path):
    app = Flask("admin-support-api-tests")
    app.config.update(
        TESTING=True,
        SECRET_KEY="test-secret",
        JWT_SECRET_KEY="test-jwt-secret-for-admin-support-tests-2026",
        JWT_TOKEN_LOCATION=["headers"],
        JWT_COOKIE_CSRF_PROTECT=False,
        SQLALCHEMY_DATABASE_URI="sqlite+pysqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_DIR=str(tmp_path),
    )
    db.init_app(app)
    jwt.init_app(app)
    app.register_blueprint(admin_support_bp)

    with app.app_context():
        db.create_all()
        user = User(
            email="admin.test@example.invalid",
            username="admin-test",
            password_hash="not-used-in-route-test",
            role="admin",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
        token = create_access_token(identity=str(user.id))
        user_id = user.id

    client = app.test_client()
    yield client, {"Authorization": f"Bearer {token}"}, user_id

    with app.app_context():
        db.session.remove()
        db.drop_all()


def _make_dataset(user_id):
    dataset = DatasetInfo(
        dataset_name="Dataset Test",
        source_name="fixture",
        original_filename="clean.csv",
        storage_path="/private/path/not-returned.csv",
        file_hash_sha256="a" * 64,
        start_date=date(2021, 1, 1),
        end_date=date(2021, 1, 2),
        latitude_min=-7.0,
        latitude_max=-6.0,
        longitude_min=106.0,
        longitude_max=107.0,
        raw_row_count=2,
        cleaned_row_count=2,
        rejected_row_count=0,
        preprocessing_version="test-1",
        validation_report={"accepted_rows": 2, "rejected_rows": 0},
        status="READY",
        uploaded_by=user_id,
    )
    db.session.add(dataset)
    db.session.flush()
    return dataset


def test_validate_dataset_is_dry_run_and_accepts_zero_depth(api_client):
    client, headers, _user_id = api_client
    csv_data = (
        "event_id,tanggal,latitude,longitude,magnitude,kedalaman,lokasi\n"
        "EV-001,2021-01-01T00:00:00+07:00,-6.2,106.8,4.5,0,\n"
    ).encode()

    response = client.post(
        "/api/admin/datasets/validate",
        headers=headers,
        data={"file": (BytesIO(csv_data), "clean.csv")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["meta"]["status"] == "success"
    assert body["data"]["valid"] is True
    assert body["data"]["persisted"] is False
    assert body["data"]["row_count"] == 1
    assert body["data"]["rules"]["latitude_min"] == -15.0


def test_validate_dataset_rejects_timestamp_without_timezone(api_client):
    client, headers, _user_id = api_client
    csv_data = (
        "event_id,tanggal,latitude,longitude,magnitude,kedalaman,lokasi\n"
        "EV-001,2021-01-01T00:00:00,-6.2,106.8,4.5,10,Jakarta\n"
    ).encode()

    response = client.post(
        "/api/admin/datasets/validate",
        headers=headers,
        data={"file": (BytesIO(csv_data), "invalid.csv")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    body = response.get_json()
    assert body["meta"]["code"] == "VALIDATION_ERROR"
    assert body["data"] is None


def test_dataset_detail_does_not_expose_storage_path(api_client):
    client, headers, user_id = api_client
    with client.application.app_context():
        dataset = _make_dataset(user_id)
        dataset_id = dataset.id
        db.session.commit()

    response = client.get(f"/api/admin/datasets/{dataset_id}", headers=headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["id"] == dataset_id
    assert data["dataset_name"] == "Dataset Test"
    assert data["validation_report"]["accepted_rows"] == 2
    assert "storage_path" not in data


def test_run_detail_includes_selected_experiment_and_job(api_client):
    client, headers, user_id = api_client
    with client.application.app_context():
        dataset = _make_dataset(user_id)
        job = ProcessingJob(
            dataset_id=dataset.id,
            run_id=None,
            job_type="PARAMETER_SEARCH",
            status="SUCCESS",
            progress=100,
            current_step="COMPLETED",
            message="Parameter search selesai",
            created_by=user_id,
        )
        db.session.add(job)
        db.session.flush()
        experiment = DBSCANParameterExperiment(
            dataset_id=dataset.id,
            job_id=job.id,
            eps_km=5.0,
            eps_radian=5.0 / 6371.0088,
            min_samples=5,
            cluster_count=2,
            noise_count=1,
            noise_percentage=100.0 / 6.0,
            clustered_count=5,
            silhouette_score=0.4,
            silhouette_sample_size=5,
            is_valid=True,
            is_recommended=False,
        )
        db.session.add(experiment)
        db.session.flush()
        run = DBSCANRun(
            dataset_id=dataset.id,
            selected_experiment_id=experiment.id,
            eps_km=experiment.eps_km,
            eps_radian=experiment.eps_radian,
            min_samples=experiment.min_samples,
            metric="haversine",
            earth_radius_km=6371.0088,
            cluster_count=2,
            noise_count=1,
            noise_percentage=100.0 / 6.0,
            total_points=6,
            silhouette_score=0.4,
            status="SUCCESS",
            is_active=False,
            created_by=user_id,
            # DB constraint ck_run_success_requires_results requires a
            # completion timestamp whenever status is SUCCESS.
            completed_at=datetime.now(timezone.utc),
        )
        db.session.add(run)
        db.session.flush()
        final_job = ProcessingJob(
            dataset_id=dataset.id,
            run_id=run.id,
            job_type="FINAL_CLUSTERING",
            status="SUCCESS",
            progress=100,
            current_step="COMPLETED",
            message="Final DBSCAN selesai",
            created_by=user_id,
        )
        db.session.add(final_job)
        db.session.commit()
        run_id = run.id

    response = client.get(f"/api/admin/runs/{run_id}", headers=headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["run"]["id"] == run_id
    assert data["selected_experiment"]["id"] is not None
    assert data["job"]["status"] == "SUCCESS"
    assert data["job"]["progress"] == 100


def test_audit_log_list_supports_filters_and_pagination(api_client):
    client, headers, user_id = api_client
    with client.application.app_context():
        db.session.add_all([
            AuditLog(
                user_id=user_id,
                action="DATASET_UPLOAD",
                entity_type="dataset",
                entity_id=11,
                details={"filename": "one.csv"},
                ip_address="127.0.0.1",
                user_agent="pytest",
            ),
            AuditLog(
                user_id=user_id,
                action="DBSCAN_RUN_ACTIVATED",
                entity_type="dbscan_run",
                entity_id=22,
                details={"dataset_id": 1},
                ip_address="127.0.0.1",
                user_agent="pytest",
            ),
        ])
        db.session.commit()

    response = client.get(
        "/api/admin/audit-logs?action=DATASET_UPLOAD&page=1&limit=10",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["meta"]["count"] == 1
    assert len(body["data"]) == 1
    assert body["data"][0]["action"] == "DATASET_UPLOAD"
    assert body["data"][0]["user"]["username"] == "admin-test"


def test_admin_support_routes_require_authentication(api_client):
    client, _headers, _user_id = api_client
    response = client.get("/api/admin/audit-logs")
    assert response.status_code == 401
