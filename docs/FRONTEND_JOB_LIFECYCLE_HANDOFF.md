# Frontend Handoff — Job Lifecycle Control

## Endpoints
- `POST /api/admin/jobs/{jobId}/pause`
- `POST /api/admin/jobs/{jobId}/resume`
- `POST /api/admin/jobs/{jobId}/stop`
- `POST /api/admin/jobs/{jobId}/restart`
- `GET /api/admin/jobs/{jobId}` for polling state/checkpoint

Use the existing cookie JWT and CSRF behavior. Do not send a request body.

## UI behavior
- `RUNNING`: show Pause and Stop.
- `PAUSE_REQUESTED`: show a non-actionable "Pausing…" state; poll until `PAUSED` or a terminal state.
- `PAUSED`: show Resume and Stop.
- `STOP_REQUESTED`: show a non-actionable "Stopping…" state; poll until `CANCELLED`, `FAILED`, or `SUCCESS`.
- `QUEUED`: show Pause and Stop.
- `FAILED` or `CANCELLED`: show Restart only when backend accepts it. Restart returns a new `id` and `parent_job_id`.
- `SUCCESS`: no lifecycle controls.

A successful Pause request may return `PAUSE_REQUESTED`; this is not yet confirmation that execution stopped. Only `PAUSED` confirms the worker reached a safe checkpoint.

Resume keeps the same Job ID but has a new `celery_task_id`. Restart creates a new Job ID; navigate/poll using the new ID. Keep the predecessor visible in history through `parent_job_id`.

## Checkpoint details
`GET /api/admin/jobs/{id}` returns `checkpoint_data`, `pause_requested_at`, `paused_at`, `stop_requested_at`, and `parent_job_id`.

For Parameter Search, resume skips already persisted parameter combinations. K-distance and Elbow artifacts can be regenerated idempotently.

For Final DBSCAN, pause is cooperative at stage boundaries. If pause is requested while `DBSCAN.fit_predict` is running, the worker acknowledges it after the fit returns. Labels are not persisted as a checkpoint file, so resume recomputes the fit from the safe checkpoint. The UI should not imply instruction-level suspension or instant pause.

## Error handling
- `404 NOT_FOUND`: Job does not exist.
- `409 JOB_LIFECYCLE_CONFLICT`: requested transition is not allowed or the legacy Job lacks a saved input payload.
- `500 JOB_LIFECYCLE_FAILED`: unexpected backend failure; refresh Job detail before retrying the action.
