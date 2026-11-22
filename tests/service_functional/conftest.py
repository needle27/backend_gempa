"""Isolated SQLite fixtures for functional tests of the Flask services."""

from datetime import datetime, timedelta, timezone

import pytest
from flask import Flask
from sqlalchemy import event
from sqlalchemy.pool import StaticPool

from extensions import db
import models  # noqa: F401 - register every ORM model before create_all
from services.auth_service import AuthService
from services.dataset_service import DatasetService


@pytest.fixture()
def app():
    test_app = Flask("service-functional-tests")
    test_app.config.update(
        TESTING=True,
        SECRET_KEY="webgis-test-only-secret-key-minimum-32-bytes-2026",
        SQLALCHEMY_DATABASE_URI="sqlite+pysqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={
            "poolclass": StaticPool,
            "connect_args": {"check_same_thread": False},
        },
    )

    db.init_app(test_app)

    with test_app.app_context():
        engine = db.engine

        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(connection, _record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        db.create_all()
        yield test_app

        db.session.remove()
        # SQLite may otherwise block dropping tables that reference one another.
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        db.drop_all()


@pytest.fixture()
def admin_user(app):
    # The app fixture already keeps its application context active.
    return AuthService().create_admin(
        email="admin.test@example.invalid",
        username="admin-test",
        password="Strong-Test-Password-123!",
    )


@pytest.fixture()
def earthquake_rows():
    """Six synthetic points in two deliberately separated spatial groups."""
    base = datetime(2021, 1, 1, 0, 0, tzinfo=timezone(timedelta(hours=7)))
    points = [
        (-6.2000, 106.8000, 4.1, 10.0, "Lokasi A"),
        (-6.2005, 106.8005, 4.3, 80.0, "Lokasi A"),
        (-6.1995, 106.7995, 4.5, 120.0, "Lokasi A"),
        (-7.0000, 107.0000, 3.9, 20.0, "Lokasi B"),
        (-7.0005, 107.0005, 4.2, 50.0, "Lokasi B"),
        (-6.9995, 106.9995, 4.6, 350.0, "Lokasi B"),
    ]
    return [
        {
            "event_id": f"TEST-EQ-{index:03d}",
            "tanggal": (base + timedelta(hours=index)).isoformat(),
            "latitude": latitude,
            "longitude": longitude,
            "magnitude": magnitude,
            "kedalaman": depth,
            "lokasi": location,
        }
        for index, (latitude, longitude, magnitude, depth, location) in enumerate(points, start=1)
    ]


@pytest.fixture()
def seeded_dataset(app, admin_user, earthquake_rows):
    """Create a user and a clean six-row dataset in the isolated test database."""
    import hashlib

    # Reuse the application context/session supplied by the app fixture.
    dataset = DatasetService().import_clean_rows(
        metadata={
            "dataset_name": "Dataset Uji Fungsional",
            "source_name": "Synthetic test fixture",
            "original_filename": "synthetic_earthquakes.csv",
            "storage_path": "/tmp/synthetic_earthquakes.csv",
            "preprocessing_version": "test-fixture-1",
        },
        rows=earthquake_rows,
        uploaded_by=admin_user.id,
        file_hash_sha256=hashlib.sha256(b"functional-test-dataset-v1").hexdigest(),
    )
    return {"user": admin_user, "dataset": dataset}
