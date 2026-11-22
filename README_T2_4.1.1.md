# SEISMAP BE 4.1.1 — T2 Knee p95

Scope: T2 only (K-distance Knee detection and elbow JSON metadata).

## Files

- `services/parameter_search_service.py`
- `services/elbow_artifact_service.py`
- `tests/unit/test_elbow_calculation.py`

## Method changes

1. Keep the full sorted Haversine K-distance curve for CSV, analysis, and later steps.
2. Compute p90, p95, and p98 from the complete sorted curve using NumPy's linear percentile method.
3. Pass only the first `ceil(0.95 * N)` sorted observations to `KneeLocator`.
4. Keep the KneeLocator x-axis as original 1-based ranks `1..cutoff_count`.
5. Map the returned 1-based rank to the original full curve using `sorted_km[knee_index - 1]`.
6. Preserve legacy `epsilon_km` and `epsilon_radian` fields; add `eps_knee_km` and cutoff/percentile metadata.
7. Store the method version `4.1.1` in the curve result and JSON artifact metadata.
8. Add a visible p95 cutoff marker to the per-MinPts K-distance plot.

## Added metadata

- `method_version`
- `k_distance_percentiles_km.p90`
- `k_distance_percentiles_km.p95`
- `k_distance_percentiles_km.p98`
- `percentile_method`
- `knee_input_cutoff`
- `knee_input_point_count`
- `knee_index` (1-based rank)
- `eps_knee_km`

## Compatibility

The full `k_distance_km` array remains unchanged. Existing `knee_index`, `epsilon_km`, and `epsilon_radian` keys remain available. This patch does not change KNN, Haversine distance, DBSCAN, API routes, or database schema.

## Apply

The patch was prepared against the source snapshot uploaded in this conversation. First check that the current working tree matches that source:

```bash
git apply --check T2_KNEE_P95_BE41_4.1.1.patch
```

If the check succeeds, apply it:

```bash
git apply T2_KNEE_P95_BE41_4.1.1.patch
```

If it fails, inspect the diff and merge the T2 changes into the current files; do not force replacement of newer local edits.

## Tests

New tests cover:

- KneeLocator receives only the p95 prefix while the stored curve remains complete.
- The original 1-based Knee rank maps to the correct epsilon in the complete curve.
- p90/p95/p98 are computed from the complete curve.
- The elbow JSON stores the cutoff, rank, epsilon, percentiles, and method version.

Run in the BE 4.1 virtual environment:

```bash
python -m compileall -q services tests
python -m pytest -q tests/unit/test_elbow_calculation.py
python -m pytest -q
```
