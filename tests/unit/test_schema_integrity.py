from datetime import date, datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import (
    ClusterProfile,
    DBSCANParameterExperiment,
    DBSCANRun,
    DatasetInfo,
    Earthquake,
    ProcessingJob,
    User,
)


@pytest.fixture()
def schema_db(app):
    with app.app_context():
        db.create_all()
        yield
        db.session.rollback()
        db.drop_all()
        db.session.remove()


def _user():
    user = User(
        email="schema-admin@example.test",
        username="schema-admin",
        password_hash="argon2-placeholder-for-schema-test",
    )
    db.session.add(user)
    db.session.flush()
    return user


def _dataset(user, **overrides):
    values = {
        "dataset_name": "Schema fixture",
        "source_name": "Fixture",
        "original_filename": "fixture.csv",
        "storage_path": "private/fixture.csv",
        "file_hash_sha256": "b" * 64,
        "start_date": date(2021, 1, 1),
        "end_date": date(2021, 1, 2),
        "latitude_min": -6.3,
        "latitude_max": -6.1,
        "longitude_min": 106.7,
        "longitude_max": 106.9,
        "raw_row_count": 100,
        "cleaned_row_count": 100,
        "rejected_row_count": 0,
        "status": "READY",
        "uploaded_by": user.id,
    }
    values.update(overrides)
    dataset = DatasetInfo(**values)
    db.session.add(dataset)
    db.session.flush()
    return dataset


def _job(user, dataset):
    job = ProcessingJob(
        dataset_id=dataset.id,
        job_type="PARAMETER_SEARCH",
        status="SUCCESS",
        progress=100,
        created_by=user.id,
    )
    db.session.add(job)
    db.session.flush()
    return job


def _experiment(user, dataset, job):
    experiment = DBSCANParameterExperiment(
        dataset_id=dataset.id,
        job_id=job.id,
        eps_km=10.0,
        eps_radian=10.0 / 6371.0088,
        min_samples=4,
        cluster_count=1,
        noise_count=10,
        noise_percentage=10.0,
        clustered_count=90,
        min_cluster_size=90,
        median_cluster_size=90.0,
        max_cluster_size=90,
        silhouette_score=0.35,
        silhouette_sample_size=100,
        dbcv_score=0.2,
        stability_score=0.9,
        is_valid=True,
        is_recommended=True,
    )
    db.session.add(experiment)
    db.session.flush()
    return experiment


def _successful_run(user, dataset, experiment):
    now = datetime(2021, 1, 2, tzinfo=timezone.utc)
    run = DBSCANRun(
        dataset_id=dataset.id,
        selected_experiment_id=experiment.id,
        eps_km=10.0,
        eps_radian=10.0 / 6371.0088,
        min_samples=4,
        metric="haversine",
        earth_radius_km=6371.0088,
        cluster_count=1,
        noise_count=10,
        noise_percentage=10.0,
        total_points=100,
        silhouette_score=0.35,
        silhouette_sample_size=90,
        dbcv_score=0.2,
        status="SUCCESS",
        created_by=user.id,
        completed_at=now,
    )
    db.session.add(run)
    db.session.flush()
    return run


def test_dataset_bounding_box_is_mandatory(schema_db):
    columns = DatasetInfo.__table__.columns
    assert columns.latitude_min.nullable is False
    assert columns.latitude_max.nullable is False
    assert columns.longitude_min.nullable is False
    assert columns.longitude_max.nullable is False


def test_dataset_rejects_reversed_bounding_box(schema_db):
    user = _user()

    # _dataset() calls flush(), so the CHECK violation is raised there,
    # not later at commit().
    with pytest.raises(IntegrityError):
        _dataset(user, latitude_min=-6.0, latitude_max=-6.5)

    db.session.rollback()


def test_earthquake_rejects_degree_radian_mismatch(schema_db):
    user = _user()
    dataset = _dataset(user)
    event = Earthquake(
        dataset_id=dataset.id,
        event_id="invalid-radian-event",
        tanggal=datetime(2021, 1, 1, tzinfo=timezone.utc),
        latitude=-6.2,
        longitude=106.8,
        latitude_rad=0.0,
        longitude_rad=106.8 * 0.017453292519943295,
        magnitude=4.0,
        kedalaman=10.0,
    )
    db.session.add(event)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_experiment_rejects_inconsistent_noise_percentage(schema_db):
    user = _user()
    dataset = _dataset(user)
    job = _job(user, dataset)
    experiment = _experiment(user, dataset, job)
    experiment.noise_percentage = 25.0
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_run_cannot_be_active_before_success(schema_db):
    user = _user()
    dataset = _dataset(user)
    job = _job(user, dataset)
    experiment = _experiment(user, dataset, job)
    run = DBSCANRun(
        dataset_id=dataset.id,
        selected_experiment_id=experiment.id,
        eps_km=10.0,
        eps_radian=10.0 / 6371.0088,
        min_samples=4,
        metric="haversine",
        earth_radius_km=6371.0088,
        status="DRAFT",
        is_active=True,
        created_by=user.id,
        activated_at=datetime.now(timezone.utc),
    )
    db.session.add(run)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_cluster_profile_rejects_inconsistent_magnitude_order(schema_db):
    user = _user()
    dataset = _dataset(user)
    job = _job(user, dataset)
    experiment = _experiment(user, dataset, job)
    run = _successful_run(user, dataset, experiment)
    profile = ClusterProfile(
        dbscan_run_id=run.id,
        cluster_id=0,
        event_count=90,
        min_magnitude=3.0,
        avg_magnitude=2.0,
        max_magnitude=5.0,
        avg_depth=10.0,
        min_depth=5.0,
        max_depth=20.0,
        shallow_event_count=20,
        medium_event_count=40,
        deep_event_count=30,
        first_event_date=datetime(2021, 1, 1, tzinfo=timezone.utc),
        last_event_date=datetime(2021, 1, 2, tzinfo=timezone.utc),
        centroid_latitude=-6.2,
        centroid_longitude=106.8,
        radius_km=10.0,
        max_radius_km=20.0,
    )
    db.session.add(profile)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
