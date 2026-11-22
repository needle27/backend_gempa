"""API + Celery + database integration tests on isolated SQLite."""

import io

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from extensions import db
from services.auth_service import AuthService


@pytest.fixture()
def api_context(tmp_path):
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "webgis-integration-test-secret-key-2026-only",
            "JWT_SECRET_KEY": "webgis-integration-jwt-secret-key-2026-only",
            "SQLALCHEMY_DATABASE_URI": "sqlite+pysqlite:///:memory:",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
            "REDIS_URL": "redis://localhost:6379/15",
            "CELERY_BROKER_URL": "memory://",
            "CELERY_RESULT_BACKEND": "cache+memory://",
            "FRONTEND_ORIGINS": ["http://localhost:5173"],
            "RATELIMIT_STORAGE_URI": "memory://",
            "JWT_TOKEN_LOCATION": ["headers", "cookies"],
            "UPLOAD_DIR": str(tmp_path / "uploads"),
            "ARTIFACT_DIR": str(tmp_path / "artifacts"),
            "CELERY_TASK_ALWAYS_EAGER": True,
            "CELERY_TASK_EAGER_PROPAGATES": True,
        }
    )
    celery = app.extensions["celery"]
    celery.conf.update(task_always_eager=True, task_eager_propagates=True)

    with app.app_context():
        db.create_all()
        user = AuthService().create_admin(
            email="integration-admin@example.invalid",
            username="integration-admin",
            password="Integration-Password-123!",
        )
        token = create_access_token(identity=str(user.id))

    client = app.test_client()
    headers = {"Authorization": f"Bearer {token}"}
    yield app, client, headers

    with app.app_context():
        db.session.remove()
        db.drop_all()


def _clean_csv_bytes():
    rows = [
        ("EQ-001", "2021-01-01T00:00:00+07:00", -6.2000, 106.8000, 4.1, 10, "Lokasi A"),
        ("EQ-002", "2021-01-01T01:00:00+07:00", -6.2005, 106.8005, 4.3, 80, "Lokasi A"),
        ("EQ-003", "2021-01-01T02:00:00+07:00", -6.1995, 106.7995, 4.5, 120, "Lokasi A"),
        ("EQ-004", "2021-01-02T00:00:00+07:00", -7.0000, 107.0000, 3.9, 20, "Lokasi B"),
        ("EQ-005", "2021-01-02T01:00:00+07:00", -7.0005, 107.0005, 4.2, 50, "Lokasi B"),
        ("EQ-006", "2021-01-02T02:00:00+07:00", -6.9995, 106.9995, 4.6, 350, "Lokasi B"),
    ]
    lines = ["event_id,tanggal,latitude,longitude,magnitude,kedalaman,lokasi"]
    lines.extend(",".join(map(str, row)) for row in rows)
    return ("\n".join(lines) + "\n").encode("utf-8")


def test_admin_auth_login_and_me(api_context):
    _app, client, _headers = api_context
    login = client.post(
        "/api/auth/login",
        json={
            "email": "integration-admin@example.invalid",
            "password": "Integration-Password-123!",
        },
    )
    assert login.status_code == 200
    assert "access_token_cookie" in login.headers.get("Set-Cookie", "")

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["data"]["role"] == "admin"


def test_public_api_requires_published_run(api_context):
    _app, client, _headers = api_context
    response = client.get("/api/metadata")
    assert response.status_code == 404
    assert response.get_json()["meta"]["code"] == "NOT_FOUND"


def test_end_to_end_upload_parameter_search_final_run_and_public_webgis(api_context):
    _app, client, headers = api_context

    upload = client.post(
        "/api/admin/datasets",
        data={
            "dataset_name": "Dataset Integration Test",
            "source_name": "Synthetic integration fixture",
            "preprocessing_version": "integration-test-1",
            "file": (io.BytesIO(_clean_csv_bytes()), "earthquakes_clean.csv"),
        },
        content_type="multipart/form-data",
        headers=headers,
    )
    assert upload.status_code == 201, upload.get_json()
    dataset_id = upload.get_json()["data"]["dataset_id"]

    invalid_grid_toggle = client.post(
        f"/api/admin/datasets/{dataset_id}/parameter-search",
        json={
            "min_samples_candidates": [2],
            "sensitivity_percentages": [0],
            "eps_candidates_km": [2.0],
            "use_default_grid": "false",
        },
        headers=headers,
    )
    assert invalid_grid_toggle.status_code == 422

    invalid_large_epsilon = client.post(
        f"/api/admin/datasets/{dataset_id}/parameter-search",
        json={
            "min_samples_candidates": [2],
            "sensitivity_percentages": [0],
            "eps_candidates_km": [1000.1],
        },
        headers=headers,
    )
    assert invalid_large_epsilon.status_code == 422
    assert "1.000 km" in invalid_large_epsilon.get_json()["meta"]["message"]

    invalid_negative_epsilon = client.post(
        f"/api/admin/datasets/{dataset_id}/parameter-search",
        json={
            "min_samples_candidates": [2],
            "sensitivity_percentages": [0],
            "eps_candidates_km": [-1.0],
        },
        headers=headers,
    )
    assert invalid_negative_epsilon.status_code == 422

    search = client.post(
        f"/api/admin/datasets/{dataset_id}/parameter-search",
        json={
            "min_samples_candidates": [2],
            "sensitivity_percentages": [0],
            # Legacy request shape: the new toggle is omitted and server default applies.
            # Explicit epsilon is additive to Knee sensitivity and the default grid.
            "eps_candidates_km": [2.0],
        },
        headers=headers,
    )
    assert search.status_code == 202, search.get_json()
    job_id = search.get_json()["data"]["job_id"]

    job_response = client.get(f"/api/admin/jobs/{job_id}", headers=headers)
    assert job_response.status_code == 200
    assert job_response.get_json()["data"]["status"] == "SUCCESS"
    search_metadata = job_response.get_json()["data"]["parameter_search_metadata"]
    assert search_metadata["combination_mode"] == "cross"
    assert search_metadata["use_default_grid"] is True
    assert search_metadata["rounding_km"] == 0.5
    assert search_metadata["default_grid"]
    assert search_metadata["epsilon_candidates_km"] == sorted(
        search_metadata["epsilon_candidates_km"]
    )
    assert search_metadata["combination_count"] == (
        search_metadata["epsilon_candidate_count"]
        * len(search_metadata["min_samples_candidates"])
    )

    elbow_summary = client.get(f"/api/admin/jobs/{job_id}/elbow", headers=headers)
    assert elbow_summary.status_code == 200, elbow_summary.get_json()
    elbow_data = elbow_summary.get_json()["data"]
    assert elbow_data["ready"] is True
    assert elbow_data["metric"] == "haversine"
    assert elbow_data["curves"]
    min_samples = elbow_data["curves"][0]["min_samples"]

    elbow_detail = client.get(
        f"/api/admin/jobs/{job_id}/elbow/{min_samples}", headers=headers
    )
    assert elbow_detail.status_code == 200, elbow_detail.get_json()
    assert elbow_detail.get_json()["data"]["point_count"] == 6

    elbow_plot = client.get(
        f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=plot",
        headers=headers,
    )
    assert elbow_plot.status_code == 200
    assert elbow_plot.mimetype == "image/png"

    elbow_csv = client.get(
        f"/api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=data",
        headers=headers,
    )
    assert elbow_csv.status_code == 200
    assert elbow_csv.mimetype == "text/csv"

    jobs_response = client.get(
        f"/api/admin/jobs?page=1&limit=20&status=SUCCESS"
        f"&job_type=PARAMETER_SEARCH&dataset_id={dataset_id}",
        headers=headers,
    )
    assert jobs_response.status_code == 200
    jobs_body = jobs_response.get_json()
    assert jobs_body["meta"]["count"] == 1
    assert jobs_body["data"][0]["id"] == job_id
    assert jobs_body["data"][0]["progress"] == 100

    experiments_response = client.get(
        f"/api/admin/jobs/{job_id}/experiments",
        headers=headers,
    )
    assert experiments_response.status_code == 200
    experiments = experiments_response.get_json()["data"]
    valid_experiments = [item for item in experiments if item["is_valid"]]
    assert valid_experiments, experiments
    experiment_id = valid_experiments[0]["id"]

    final = client.post(
        f"/api/admin/datasets/{dataset_id}/runs",
        json={
            "experiment_id": experiment_id,
        },
        headers=headers,
    )
    assert final.status_code == 202, final.get_json()
    final_data = final.get_json()["data"]
    run_id = final_data["run_id"]
    final_job_id = final_data["job_id"]

    final_job = client.get(f"/api/admin/jobs/{final_job_id}", headers=headers)
    assert final_job.status_code == 200
    assert final_job.get_json()["data"]["status"] == "SUCCESS"

    all_jobs = client.get(
        f"/api/admin/jobs?page=1&limit=20&dataset_id={dataset_id}",
        headers=headers,
    )
    assert all_jobs.status_code == 200
    all_jobs_data = all_jobs.get_json()["data"]
    assert {item["id"] for item in all_jobs_data} == {job_id, final_job_id}
    assert all_jobs.get_json()["meta"]["count"] == 2

    activation = client.post(
        f"/api/admin/runs/{run_id}/activate",
        headers=headers,
        json={},
    )
    assert activation.status_code == 200, activation.get_json()
    assert activation.get_json()["data"]["run"]["is_active"] is True

    metadata = client.get("/api/metadata")
    summary = client.get("/api/summary")
    profiles = client.get("/api/profil")
    earthquakes = client.get("/api/gempa?limit=20")

    assert metadata.status_code == 200
    assert summary.status_code == 200
    assert profiles.status_code == 200
    assert earthquakes.status_code == 200

    assert metadata.get_json()["data"]["run"]["id"] == run_id
    assert metadata.get_json()["data"]["dataset"]["id"] == dataset_id
    assert summary.get_json()["data"]["total_points"] == 6
    assert summary.get_json()["data"]["cluster_count"] == 2
    assert len(profiles.get_json()["data"]) == 2
    assert len(earthquakes.get_json()["data"]) == 6


def test_admin_routes_reject_missing_token(api_context):
    _app, client, _headers = api_context
    response = client.get("/api/admin/datasets")
    assert response.status_code == 401


def test_upload_rejects_missing_required_csv_columns(api_context):
    _app, client, headers = api_context
    bad_csv = b"event_id,tanggal,latitude,longitude,magnitude\nEQ-1,2021-01-01T00:00:00+07:00,-6,106,4.0\n"
    response = client.post(
        "/api/admin/datasets",
        data={
            "dataset_name": "Invalid Dataset",
            "source_name": "Integration fixture",
            "file": (io.BytesIO(bad_csv), "invalid.csv"),
        },
        content_type="multipart/form-data",
        headers=headers,
    )
    assert response.status_code == 422
    assert response.get_json()["meta"]["code"] == "VALIDATION_ERROR"
