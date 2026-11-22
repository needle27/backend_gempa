"""Celery integration with Flask application context."""

from __future__ import annotations

from celery import Celery, Task


def create_celery_app(flask_app) -> Celery:
    celery = Celery(
        flask_app.import_name,
        broker=flask_app.config["CELERY_BROKER_URL"],
        backend=flask_app.config["CELERY_RESULT_BACKEND"],
    )
    celery.conf.update(
        broker_url=flask_app.config["CELERY_BROKER_URL"],
        result_backend=flask_app.config["CELERY_RESULT_BACKEND"],
        task_track_started=flask_app.config["CELERY_TASK_TRACK_STARTED"],
        task_acks_late=flask_app.config["CELERY_TASK_ACKS_LATE"],
        worker_prefetch_multiplier=flask_app.config["CELERY_WORKER_PREFETCH_MULTIPLIER"],
        task_serializer=flask_app.config["CELERY_TASK_SERIALIZER"],
        result_serializer=flask_app.config["CELERY_RESULT_SERIALIZER"],
        accept_content=flask_app.config["CELERY_ACCEPT_CONTENT"],
        timezone=flask_app.config["CELERY_TIMEZONE"],
        enable_utc=flask_app.config["CELERY_ENABLE_UTC"],
        task_always_eager=flask_app.config.get("CELERY_TASK_ALWAYS_EAGER", False),
        task_eager_propagates=flask_app.config.get("CELERY_TASK_EAGER_PROPAGATES", False),
    )

    class FlaskContextTask(Task):
        abstract = True

        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = FlaskContextTask
    return celery
