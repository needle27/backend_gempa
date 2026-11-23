"""Celery integration with Flask application context."""

from __future__ import annotations

import ssl
from celery import Celery, Task


def create_celery_app(flask_app) -> Celery:
    broker_url = str(flask_app.config.get("CELERY_BROKER_URL", ""))
    backend_url = str(flask_app.config.get("CELERY_RESULT_BACKEND", ""))

    if broker_url.startswith("rediss://") and "ssl_cert_reqs" not in broker_url:
        sep = "&" if "?" in broker_url else "?"
        broker_url = f"{broker_url}{sep}ssl_cert_reqs=CERT_NONE"

    if backend_url.startswith("rediss://") and "ssl_cert_reqs" not in backend_url:
        sep = "&" if "?" in backend_url else "?"
        backend_url = f"{backend_url}{sep}ssl_cert_reqs=CERT_NONE"

    conf_updates = {
        "broker_url": broker_url,
        "result_backend": backend_url,
        "task_track_started": flask_app.config["CELERY_TASK_TRACK_STARTED"],
        "task_acks_late": flask_app.config["CELERY_TASK_ACKS_LATE"],
        "worker_prefetch_multiplier": flask_app.config["CELERY_WORKER_PREFETCH_MULTIPLIER"],
        "task_serializer": flask_app.config["CELERY_TASK_SERIALIZER"],
        "result_serializer": flask_app.config["CELERY_RESULT_SERIALIZER"],
        "accept_content": flask_app.config["CELERY_ACCEPT_CONTENT"],
        "timezone": flask_app.config["CELERY_TIMEZONE"],
        "enable_utc": flask_app.config["CELERY_ENABLE_UTC"],
        "task_always_eager": flask_app.config.get("CELERY_TASK_ALWAYS_EAGER", False),
        "task_eager_propagates": flask_app.config.get("CELERY_TASK_EAGER_PROPAGATES", False),
    }

    if broker_url.startswith("rediss://"):
        conf_updates["broker_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}
    if backend_url.startswith("rediss://"):
        conf_updates["redis_backend_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}

    celery = Celery(
        flask_app.import_name,
        broker=broker_url,
        backend=backend_url,
    )
    celery.conf.update(**conf_updates)

    class FlaskContextTask(Task):
        abstract = True

        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = FlaskContextTask
    return celery
