# SEISMAP Elbow Analysis — Backend / Frontend Contract

## Goal

Give administrators an evidence-based view of DBSCAN epsilon candidates through
K-distance / Elbow curves, with comparison and per-MinPts detail. Backend owns
all scientific calculations; frontend only renders supplied points and actions.

## Existing processing flow

`POST /api/admin/datasets/{dataset_id}/parameter-search` remains the entry point.
The existing request fields remain compatible:

- `min_samples_candidates`: required integer array
- `sensitivity_percentages`: optional, defaults to `[-20,-10,0,10,20]`
- `eps_candidates_km`: optional explicit epsilon array

Every Parameter Search job now calculates and stores Elbow artifacts, even when
explicit epsilon candidates were supplied. If epsilon values are not explicit,
detected Knee epsilon values seed sensitivity candidates. A missing Knee is
recorded; it is not fabricated. If no candidate has a Knee and no explicit
epsilon was supplied, the job fails with a clear processing error after the
Elbow artifacts are saved for diagnosis.

## New endpoints

All endpoints require the existing admin JWT cookie authentication.

### GET `/api/admin/jobs/{job_id}/elbow`

Returns comparison metadata and links:

```json
{
  "data": {
    "job_id": 20,
    "dataset_id": 1,
    "job_status": "SUCCESS",
    "ready": true,
    "metric": "haversine",
    "distance_unit": "km",
    "curves": [
      {
        "min_samples": 20,
        "point_count": 59847,
        "knee_detected": true,
        "epsilon_km": 12.34,
        "knee_percentile": 99.5,
        "points_after_knee": 300,
        "epsilon_is_candidate_only": true,
        "detail_url": "/api/admin/jobs/20/elbow/20",
        "plot_url": "/api/admin/jobs/20/elbow/20/artifact?kind=plot",
        "data_url": "/api/admin/jobs/20/elbow/20/artifact?kind=data",
        "metadata_url": "/api/admin/jobs/20/elbow/20/artifact?kind=metadata",
        "upper_tail_plot_url": "/api/admin/jobs/20/elbow/20/artifact?kind=upper_tail"
      }
    ],
    "comparison_plot_url": "/api/admin/jobs/20/elbow/comparison/artifact"
  },
  "meta": {"status": "success"}
}
```

Values above are examples only, not actual dataset results.

### GET `/api/admin/jobs/{job_id}/elbow/{min_samples}`

Returns metadata (including the `search_configuration` used for epsilon
candidate generation) and `preview_points` for the selected curve. Preview is
capped near 1,500 representative points, while preserving the first/last points and
the exact Knee point. Frontend must not recompute Knee or epsilon from preview.

### Authenticated artifact downloads

- `GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=plot` — PNG
- `GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=data` — full CSV
- `GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=metadata` — JSON
- `GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=upper_tail` — PNG with 100%, final-10%, and final-1% windows; global Knee marker is retained and not recalculated
- `GET /api/admin/jobs/{job_id}/elbow/comparison/artifact` — comparison PNG

`kind` must be `plot`, `data`, `metadata`, or `upper_tail`; invalid values return HTTP 422.
Artifact download endpoints use admin authentication and only serve files whose
resolved paths remain inside configured `ARTIFACT_DIR`.

## Artifact and database behavior

The evaluation-metrics schema change is handled by Alembic revision `20261118_0004`; the K-distance artifact registry continues using the existing artifact table. Existing `processing_artifacts`
model and database check constraint already support `K_DISTANCE_DATA` and
`K_DISTANCE_PLOT`.

Per MinPts, backend writes:

- full sorted K-distance curve CSV (`rank,distance_km`)
- JSON metadata including dataset hash, preprocessing version, metric, Earth
  radius, Knee method/status/rank, epsilon in km/radian, and preview points
- PNG K-distance plot with exact Knee marker and epsilon line when detected
- PNG upper-tail audit with 100%, final-10%, and final-1% views using the same full curve and global Knee

Per job, backend writes one comparison PNG. PostgreSQL stores artifact registry
rows, hashes, file paths, and compact metadata only; curve rows and image bytes
are not stored in PostgreSQL.

Files are stored under:

`ARTIFACT_DIR/parameter_search/dataset_{dataset_id}/job_{job_id}/attempt_{uuid}/`

Attempt-specific directories make task retries safe: previous artifact files are
retained until the replacement registry transaction commits successfully.

## Visualization requirements

- Comparison View: overlay or compare curves for candidate MinPts.
- Detail View: show preview points from API; use the PNG for download/print.
- Display axis units in km and label MinPts clearly.
- Display an explicit "Knee not detected" state when no Knee exists.
- Never invent a Knee marker or epsilon.
- Do not recompute KNN, Knee, or epsilon in the browser.
- Use `plot_url`, `data_url`, and `metadata_url` from API responses rather than
  constructing paths from untrusted values.
- Requests must include credentials because endpoints use JWT cookies.

## Performance decisions

- One BallTree-backed `kneighbors` query per Parameter Search job at maximum k.
- Smaller MinPts curves reuse the appropriate distance column from that result.
- Full curve CSV remains on artifact storage.
- Detail API returns a bounded preview, not all 59k+ points.
- PNGs are generated once by Celery, not on every page view.

## Methodology notes

- Coordinates only: latitude and longitude.
- Metric: Haversine.
- Earth radius: shared `EARTH_RADIUS_KM` constant.
- The query point itself is included in k-neighbor rank, consistent with
  DBSCAN `min_samples` semantics.
- KneeLocator configuration: S=1.0, convex, increasing, interp1d, online=False; exact configuration and sensitivity values are persisted in metadata.
- Knee is an epsilon candidate, not proof of the best DBSCAN parameter.
- Upper-tail views are visualization-only and preserve global ranks.
- Knee is an epsilon candidate, not proof of the best DBSCAN parameter.
- Magnitude, depth, time, and location remain post-clustering profiling fields.
- Depth thresholds are not added to the Final DBSCAN request.

## Existing endpoints unchanged

- `GET /api/admin/jobs`
- `GET /api/admin/jobs/{job_id}`
- `GET /api/admin/jobs/{job_id}/experiments`
- `POST /api/admin/datasets/{dataset_id}/runs` (experiment_id only)
