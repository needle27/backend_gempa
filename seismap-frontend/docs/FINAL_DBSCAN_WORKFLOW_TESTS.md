# Final DBSCAN Workflow — Manual Acceptance Tests (v0.4.3)

Run these checks against the BE 4.1 runtime after signing in as admin. No backend mutation is performed by opening the page or selecting an experiment; a final run is created only when the admin presses **Jalankan DBSCAN Final**.

## A. Source job and dataset integrity

1. Open **Job Management** and select a `PARAMETER_SEARCH` job with status `SUCCESS`.
2. Use **Gunakan eksperimen di DBSCAN Final**.
3. Confirm the Final DBSCAN page shows the source job ID and dataset ID.
4. Confirm the source job is verified as `PARAMETER_SEARCH` + `SUCCESS`.
5. Confirm only experiments matching both the source `job_id` and selected `dataset_id` are displayed.
6. Confirm only `is_valid=true` experiments can be selected.
7. Change the dataset. The source Parameter Search job and selected experiment must be cleared; the page must direct the admin to Job Management. It must not retain an experiment from the previous dataset.

## B. Experiment summary

1. Select a valid experiment.
2. Confirm the summary shows experiment ID, epsilon (km), MinPts, cluster count, noise count, noise percentage, and Silhouette Score.
3. Confirm epsilon and MinPts are read-only summary values, not editable inputs.
4. Confirm no depth minimum, depth maximum, or `depth_thresholds_km` field exists in the form or request.

## C. Duplicate-run guard

1. Before creating a run, frontend queries `GET /api/admin/jobs` for `FINAL_CLUSTERING` jobs with status `QUEUED` and `RUNNING` for the selected dataset.
2. If an active job exists, frontend must restore that job ID and must not send another `POST /api/admin/datasets/{dataset_id}/runs` request.
3. If no active job exists, frontend may send the final-run request.
4. If backend returns HTTP 409 with `details.job_id`, frontend restores that job for monitoring rather than retrying creation.
5. If the active-job check fails, frontend must fail closed and not send the final-run request.

## D. Request contract

For a successful creation attempt, inspect DevTools → Network. The request must be:

`POST /api/admin/datasets/{dataset_id}/runs`

Body:

```json
{
  "experiment_id": 264
}
```

The actual experiment ID must be the selected valid experiment. No other request field is sent.

## E. Job progress recovery

1. After HTTP 202, confirm the returned `job_id` and `run_id` appear in the progress panel.
2. While status is `QUEUED` or `RUNNING`, the submit button must remain disabled and job status must be polled.
3. Refresh the page in the same browser tab. Confirm the saved job ID is restored from `sessionStorage` and status polling resumes from `GET /api/admin/jobs/{job_id}`.
4. When status becomes `SUCCESS`, confirm a link to **Riwayat Run** appears.
5. When status becomes `FAILED`, confirm the error code/message is shown and another run is not blocked by the terminal status.
6. If job status cannot be retrieved, confirm the page blocks new submission and offers retry / Job Management. Clearing local tracking requires explicit confirmation and does not cancel a backend job.

## F. Preview mode

1. Set `VITE_UI_PREVIEW_MODE=true` using the preview environment.
2. Confirm the page shows **Mode Pratinjau / Data Simulasi**.
3. Confirm final-run submission remains disabled; no upload, run-creation, or activation request is sent.

## Important boundary

The frontend guard prevents routine duplicate submissions and checks current backend jobs before creation. It cannot eliminate a race between two clients submitting at the exact same time; the backend should retain its own conflict/concurrency protection. The frontend does not cancel Celery jobs.
