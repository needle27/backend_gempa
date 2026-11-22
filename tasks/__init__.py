"""Register background tasks on the Flask application's Celery instance."""


def register_tasks(celery):
    from tasks.parameter_search_task import register_parameter_search_task
    from tasks.final_clustering_task import register_final_clustering_task
    from tasks.health_task import register_health_check_task

    return {
        "parameter_search": register_parameter_search_task(celery),
        "final_clustering": register_final_clustering_task(celery),
        "health_check": register_health_check_task(celery),
    }
