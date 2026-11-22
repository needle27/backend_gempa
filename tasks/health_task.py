"""Safe Celery health-check task."""


def register_health_check_task(celery):
    @celery.task(name="tasks.health_check")
    def health_check():
        return {
            "status": "ok",
            "component": "celery",
            "message": "Background task executed successfully",
        }

    return health_check
