import csv
import hashlib

import pytest

from extensions import db
from repositories.audit_log_repository import AuditLogRepository
from repositories.dataset_repository import DatasetRepository
from repositories.earthquake_repository import EarthquakeRepository
from repositories.user_repository import UserRepository
from services.audit_service import AuditService
from services.auth_service import AuthService
from services.dataset_service import DatasetService
from services.exceptions import ConflictError, ValidationError


def test_auth_service_create_authenticate_and_reject_wrong_password(app):
    with app.app_context():
        service = AuthService()
        user = service.create_admin(
            email="root@example.invalid",
            username="root-admin",
            password="Correct-Horse-Battery-123!",
        )

        assert user.id is not None
        assert user.password_hash != "Correct-Horse-Battery-123!"
        assert service.authenticate(
            identity="root-admin",
            password="Correct-Horse-Battery-123!",
        ).id == user.id

        assert service.authenticate(
            identity="root@example.invalid",
            password="incorrect-password",
        ) is None

        db.session.refresh(user)
        assert user.failed_login_count == 1
        assert user.last_login_at is not None

        with pytest.raises(ConflictError):
            service.create_admin(
                email="ROOT@example.invalid",
                username="another-admin",
                password="Another-Password-123!",
            )

        assert UserRepository().count() == 1


def test_auth_service_rejects_empty_credentials(app):
    with app.app_context():
        with pytest.raises(ValidationError):
            AuthService().create_admin(email="", username="admin", password="secret")


def test_audit_service_persists_audit_entry(app, admin_user):
    with app.app_context():
        entry = AuditService().record(
            action="DATASET_UPLOAD",
            user_id=admin_user.id,
            entity_type="dataset",
            entity_id=123,
            details={"filename": "clean.csv", "accepted_rows": 6},
            ip_address="127.0.0.1",
            user_agent="pytest",
        )

        assert entry.id is not None
        assert AuditLogRepository().count() == 1
        stored = AuditLogRepository().get(entry.id)
        assert stored.action == "DATASET_UPLOAD"
        assert stored.details["accepted_rows"] == 6
        assert stored.ip_address == "127.0.0.1"


def _write_csv(path, rows):
    fieldnames = [
        "event_id", "tanggal", "latitude", "longitude",
        "magnitude", "kedalaman", "lokasi",
    ]
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def test_dataset_service_imports_clean_csv_into_postgresql_model_layer(
    app, admin_user, earthquake_rows, tmp_path
):
    with app.app_context():
        csv_path = tmp_path / "clean_earthquakes.csv"
        _write_csv(csv_path, earthquake_rows)

        dataset = DatasetService().import_clean_csv(
            file_path=csv_path,
            metadata={
                "dataset_name": "CSV Import Test",
                "source_name": "Synthetic fixture",
                "original_filename": csv_path.name,
                "storage_path": str(csv_path),
                "preprocessing_version": "test-1",
            },
            uploaded_by=admin_user.id,
        )

        assert dataset.id is not None
        assert dataset.status == "READY"
        assert dataset.raw_row_count == 6
        assert dataset.cleaned_row_count == 6
        assert dataset.rejected_row_count == 0
        assert dataset.file_hash_sha256 == hashlib.sha256(csv_path.read_bytes()).hexdigest()
        assert EarthquakeRepository().count_for_dataset(dataset.id) == 6

        first = EarthquakeRepository().list_by_dataset(dataset.id)[0]
        assert first.latitude_rad == pytest.approx(first.latitude * 0.017453292519943295)
        assert first.longitude_rad == pytest.approx(first.longitude * 0.017453292519943295)


def test_dataset_service_rejects_invalid_row_without_partial_import(
    app, admin_user, tmp_path
):
    with app.app_context():
        csv_path = tmp_path / "invalid_clean.csv"
        _write_csv(
            csv_path,
            [{
                "event_id": "BAD-001",
                "tanggal": "2021-01-01T00:00:00+07:00",
                "latitude": "-6.2",
                "longitude": "106.8",
                "magnitude": "",
                "kedalaman": "10",
                "lokasi": "Invalid row",
            }],
        )

        with pytest.raises(ValidationError):
            DatasetService().import_clean_csv(
                file_path=csv_path,
                metadata={
                    "dataset_name": "Invalid CSV",
                    "source_name": "Synthetic fixture",
                    "original_filename": csv_path.name,
                    "storage_path": str(csv_path),
                },
                uploaded_by=admin_user.id,
            )

        assert DatasetRepository().count() == 0
        assert EarthquakeRepository().count() == 0


def test_dataset_service_rejects_timestamp_without_timezone(app, admin_user):
    with app.app_context():
        rows = [{
            "event_id": "NO-TZ",
            "tanggal": "2021-01-01T00:00:00",
            "latitude": -6.2,
            "longitude": 106.8,
            "magnitude": 4.0,
            "kedalaman": 10,
        }]
        with pytest.raises(ValidationError, match="zona waktu"):
            DatasetService().import_clean_rows(
                metadata={
                    "dataset_name": "No timezone",
                    "source_name": "Synthetic fixture",
                    "original_filename": "no_timezone.csv",
                    "storage_path": "/tmp/no_timezone.csv",
                },
                rows=rows,
                uploaded_by=admin_user.id,
                file_hash_sha256=hashlib.sha256(b"no-timezone").hexdigest(),
            )
        assert DatasetRepository().count() == 0
