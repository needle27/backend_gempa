# BE 4.1 Elbow Analysis Patch

This patch integrates Elbow/K-distance artifacts into the existing Parameter Search.

## Changes
- Reuses one BallTree-backed KNN query for all MinPts candidates in a job.
- Generates per-MinPts CSV, JSON metadata, and PNG plot.
- Generates a comparison PNG per Parameter Search job.
- Registers files using existing `processing_artifacts` types.
- Adds authenticated summary, detail, and artifact download APIs.
- Adds tests and frontend contract documentation.

## Database
No migration is expected: existing schema supports `K_DISTANCE_DATA` and
`K_DISTANCE_PLOT`. PostgreSQL stores artifact registry metadata only; file
contents remain under `ARTIFACT_DIR`.

## Dependency
`matplotlib==3.10.3` is added for headless PNG generation.

## Apply
Back up the active source before extracting this patch. Install dependencies
with `pip install -r requirements.txt`, then run compile checks and tests.
Do not apply to a running worker; stop Flask/Celery first and restart both after.

## Important
The archive was prepared against the supplied BE 4.1 integrated source snapshot.
Compare with the active working tree before overwriting files. This environment
cannot execute the user's Mac runtime or verify its PostgreSQL/Redis services.
