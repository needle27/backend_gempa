"""Functional tests for cooperative Job Lifecycle Control."""

import pytest

from extensions import db
from models.job import ProcessingJob
from repositories.job_repository import JobRepository
from services.exceptions import JobPaused, JobCancelled
from services.job_lifecycle_service import JobLifecycleService
from tasks.task_utils import job_checkpoint


class _FakeTask:
    def __init__(self):
        self.calls = []

    def apply_async(self, *, kwargs, task_id):
        self.calls.append({"kwargs": kwargs, "task_id": task_id})


class _FakeControl:
    def __init__(self):
        self.revoked = []

    def revoke(self, task_id, *, terminate=False):
        self.revoked.append((task_id, terminate))


class _FakeCelery:
    def __init__(self):
        self.tasks = {
            "tasks.parameter_search": _FakeTask(),
            "tasks.final_clustering": _FakeTask(),
        }
        self.control = _FakeControl()


def _job(dataset, user, *, status="QUEUED", payload=None):
    job = ProcessingJob(
        dataset_id=dataset.id,
        run_id=None,
        job_type="PARAMETER_SEARCH",
        status=status,
        progress=0,
        current_step=status,
        message="test",
        created_by=user.id,
        input_payload=payload or {
            "min_samples_candidates": [4, 5],
            "sensitivity_percentages": [-10, 0, 10],
            "eps_candidates_km": None,
        },
    )
    db.session.add(job)
    db.session.commit()
    return job


def test_pause_resume_stop_and_restart_create_new_job(app, seeded_dataset):
    fake_celery = _FakeCelery()
    app.extensions["celery"] = fake_celery
    old = _job(seeded_dataset["dataset"], seeded_dataset["user"])
    service = JobLifecycleService()

    paused = service.pause(old.id, actor_id=seeded_dataset["user"].id)
    assert paused.status == "PAUSED"

    resumed = service.resume(old.id, actor_id=seeded_dataset["user"].id)
    assert resumed.status == "QUEUED"
    assert len(fake_celery.tasks["tasks.parameter_search"].calls) == 1

    stopped = service.stop(old.id, actor_id=seeded_dataset["user"].id)
    assert stopped.status == "CANCELLED"

    restarted = service.restart(old.id, actor_id=seeded_dataset["user"].id)
    assert restarted.id != old.id
    assert restarted.parent_job_id == old.id
    assert restarted.status == "QUEUED"
    assert len(fake_celery.tasks["tasks.parameter_search"].calls) == 2


def test_running_job_pause_is_acknowledged_only_at_checkpoint(app, seeded_dataset):
    job = _job(
        seeded_dataset["dataset"],
        seeded_dataset["user"],
        status="RUNNING",
    )
    service = JobLifecycleService()
    requested = service.pause(job.id, actor_id=seeded_dataset["user"].id)
    assert requested.status == "PAUSE_REQUESTED"

    with pytest.raises(JobPaused):
        job_checkpoint(job.id, stage="COMBINATION_2_COMPLETE", progress=50)

    refreshed = JobRepository().get(job.id)
    assert refreshed.status == "PAUSED"
    assert refreshed.checkpoint_data["stage"] == "COMBINATION_2_COMPLETE"


def test_running_job_stop_is_acknowledged_at_checkpoint(app, seeded_dataset):
    job = _job(
        seeded_dataset["dataset"],
        seeded_dataset["user"],
        status="RUNNING",
    )
    service = JobLifecycleService()
    requested = service.stop(job.id, actor_id=seeded_dataset["user"].id)
    assert requested.status == "STOP_REQUESTED"

    with pytest.raises(JobCancelled):
        job_checkpoint(job.id, stage="K_DISTANCE_COMPLETE", progress=10)

    refreshed = JobRepository().get(job.id)
    assert refreshed.status == "CANCELLED"


def test_parameter_search_resume_kwargs_keep_frozen_epsilon_configuration():
    from types import SimpleNamespace
    from services.job_lifecycle_service import JobLifecycleService

    job = SimpleNamespace(
        id=41,
        dataset_id=7,
        job_type="PARAMETER_SEARCH",
        input_payload={
            "min_samples_candidates": [8, 10],
            "sensitivity_percentages": [-20, 0, 20],
            "eps_candidates_km": [25.0],
            "use_default_grid": False,
            "epsilon_default_grid_km": [10.0, 20.0],
            "epsilon_rounding_km": 0.5,
        },
    )

    kwargs = JobLifecycleService._task_kwargs(job)
    assert kwargs["use_default_grid"] is False
    assert kwargs["epsilon_default_grid_km"] == [10.0, 20.0]
    assert kwargs["epsilon_rounding_km"] == 0.5
