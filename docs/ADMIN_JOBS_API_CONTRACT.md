# Admin Jobs List API

## Endpoint

`GET /api/admin/jobs`

Requires an authenticated administrator, consistent with the existing job detail routes.

## Query parameters

| Parameter | Required | Rules | Default |
|---|---:|---|---|
| `page` | No | Positive integer, >= 1 | `1` |
| `limit` | No | Integer from 1 through 100 | `20` |
| `status` | No | `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED` | — |
| `job_type` | No | `PARAMETER_SEARCH`, `FINAL_CLUSTERING` | — |
| `dataset_id` | No | Positive integer | — |

Filters can be combined. Results are ordered newest first by `created_at`, then by descending `id`.

## Response

`data` is an array containing `id`, `dataset_id`, `run_id`, `job_type`, `status`,
`progress`, `current_step`, `message`, `error_code`, `created_at`, `started_at`,
and `finished_at`.

`meta.count` is the total number of records matching the filters, before pagination.
`meta.limit` is the requested page size and `meta.offset` is `(page - 1) * limit`.

## Example

`GET /api/admin/jobs?page=1&limit=20&status=RUNNING&job_type=FINAL_CLUSTERING`

## Compatibility

Existing endpoints remain unchanged:

- `GET /api/admin/jobs/{job_id}`
- `GET /api/admin/jobs/{job_id}/experiments`

No database migration is required. The endpoint reads the existing `processing_jobs` table.
Invalid query parameters return HTTP 422 with `meta.code = VALIDATION_ERROR`.
