# BE 4.1 — Job Lifecycle Control patch

## Included
- Pause / Resume / Stop / Restart admin endpoints.
- Cooperative checkpoints for Parameter Search and Final DBSCAN.
- Persisted execution payload, checkpoint metadata, and parent Job lineage.
- PostgreSQL migration `20261117_0003`.
- Audit events and frontend API handoff.
- Functional tests for lifecycle state transitions.

## Apply safely
1. Stop Flask and Celery workers (warm shutdown: press CTRL+C once).
2. Back up the PostgreSQL database and current source.
3. From the BE 4.1 project root, extract this ZIP preserving paths:
   `unzip -o ~/Downloads/BE_4.1_JOB_LIFECYCLE_PATCH_REVISED.zip -d .`
4. Activate the project's virtual environment.
5. Apply migration:
   `flask --app 'app:create_app' db upgrade`
6. Run:
   `python -m compileall -q models repositories routes services tasks`
   `python -m pytest -q tests/service_functional/test_job_lifecycle.py`
   `python -m pytest -q`
7. Restart Redis if needed, then Flask and one Celery worker.

## Semantics and limits
- Pause is cooperative and only acknowledged as PAUSED at a safe checkpoint.
- Resume keeps the same Job ID and dispatches a new Celery task ID.
- Stop becomes CANCELLED at a checkpoint (or immediately if queued/paused).
- Restart creates a new Job ID with `parent_job_id`; the old Job remains unchanged.
- Existing legacy Jobs with empty `input_payload` cannot be resumed/restarted automatically.
- Final DBSCAN cannot suspend sklearn's `fit_predict` mid-call. A pause requested during fit is acknowledged after fit returns; labels are not persisted, so resume recomputes DBSCAN from the previous durable checkpoint.
- PAUSED Jobs continue to hold the per-dataset/per-job-type active slot until resumed or stopped.

## Verification status
Python syntax compilation passed for all modified Python files in the build environment.
The project's pytest suite and live PostgreSQL/Redis/Celery runtime tests were not run here because the uploaded source archive does not include its virtual environment or runtime services. Run the commands above before treating this patch as production-ready.
