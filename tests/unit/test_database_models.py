from datetime import date, datetime, timezone

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import DatasetInfo, Earthquake, User


def test_all_blueprint_tables_are_registered(app):
    expected = {
        "users",
        "dataset_info",
        "gempa_processed",
        "processing_jobs",
        "dbscan_parameter_experiments",
        "dbscan_runs",
        "dbscan_memberships",
        "profil_klaster",
        "processing_artifacts",
        "audit_logs",
    }
    assert expected.issubset(set(db.metadata.tables))


def test_sqlite_can_create_blueprint_schema(app):
    with app.app_context():
        db.create_all()
        inspector_tables = set(inspect(db.engine).get_table_names())
        assert "users" in inspector_tables
        assert "gempa_processed" in inspector_tables
        assert "dbscan_runs" in inspector_tables
        db.drop_all()


def test_user_role_check_constraint_is_enforced(app):
    with app.app_context():
        db.create_all()
        user = User(
            email="admin@example.test",
            username="admin",
            password_hash="argon2-placeholder-for-schema-test",
            role="superuser",
        )
        db.session.add(user)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        db.drop_all()


def test_earthquake_coordinate_check_constraint_is_enforced(app):
    with app.app_context():
        db.create_all()
        user = User(
            email="admin@example.test",
            username="admin",
            password_hash="argon2-placeholder-for-schema-test",
        )
        db.session.add(user)
        db.session.flush()
        dataset = DatasetInfo(
            dataset_name="Fixture dataset",
            source_name="Fixture",
            original_filename="fixture.csv",
            storage_path="private/fixture.csv",
            file_hash_sha256="a" * 64,
            start_date=date(2021, 1, 1),
            end_date=date(2021, 1, 2),
            latitude_min=-6.3,
            latitude_max=-6.1,
            longitude_min=106.7,
            longitude_max=106.9,
            raw_row_count=1,
            cleaned_row_count=1,
            rejected_row_count=0,
            status="READY",
            uploaded_by=user.id,
        )
        db.session.add(dataset)
        db.session.flush()
        event = Earthquake(
            dataset_id=dataset.id,
            event_id="fixture-event-1",
            tanggal=datetime(2021, 1, 1, tzinfo=timezone.utc),
            latitude=100.0,
            longitude=120.0,
            latitude_rad=1.0,
            longitude_rad=2.0,
            magnitude=4.0,
            kedalaman=10.0,
        )
        db.session.add(event)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        db.drop_all()
