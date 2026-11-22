# SEISMAP Frontend v0.4.7

## DBSCAN Parameter Analysis — K-Distance & Elbow Visualization

### New analysis experience
- Added an Elbow Analysis section to Admin → Pencarian Parameter.
- Added Comparison View with the preview curves for all candidate MinPts values.
- Added per-MinPts Detail View with the backend-supplied preview points, epsilon reference line, and exact Knee marker when its rank is supplied in metadata.
- Added visible `Knee Point Not Detected` state; the frontend never fabricates a Knee point or epsilon value.
- Added job and dataset context, distance metric, distance unit, point count, and selected MinPts summary.
- Added an experiment comparison table for the selected MinPts, showing epsilon values actually tested and their DBSCAN validity and evaluation metrics.

### Artifact downloads and API integration
- Added `GET /api/admin/jobs/{job_id}/elbow` and the per-curve detail endpoint through the URLs returned by the summary response.
- Added authenticated PNG, CSV, and JSON artifact downloads using the server-provided `plot_url`, `data_url`, `metadata_url`, and `comparison_plot_url`.
- Artifact requests include JWT cookies, retry once after the existing refresh endpoint on HTTP 401, and reject artifact URLs outside the configured API origin.
- Added a shortcut from successful Parameter Search jobs in Manajemen Proses to the corresponding Elbow Analysis view. Historical jobs without artifacts show a clear unavailable state.

### Methodology boundaries
- The browser does not calculate KNN, Knee, epsilon, or DBSCAN. It only renders the points and metadata returned by BE 4.1.
- K-Distance uses latitude and longitude with Haversine as produced by the backend.
- Magnitude, depth, time, and location remain profiling attributes after clustering.
- Existing Parameter Search, Job Management, experiment, and Final DBSCAN contracts remain unchanged. Final DBSCAN still submits only `experiment_id`.

### Responsive and language refinements
- Added responsive comparison/detail layouts, compact controls, contained legends, and wrapped metadata text.
- Kept Bahasa Indonesia as the primary interface language while retaining standard technical terms and file formats.
- Raw JSON is downloadable as an artifact but is not rendered as an unformatted block in the interface.

### Verification
- Full typecheck and production build could not be run in this packaging environment because frontend npm dependencies are not installed and package installation did not complete. Run `npm install`, `npm run typecheck`, and `npm run build` in the local frontend environment before replacing the active frontend.
