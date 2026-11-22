# Frontend Integration Notes — Backend 4.1.3 T3

## Parameter Search request

`POST /api/admin/datasets/{dataset_id}/parameter-search`

Frontend sends all four fields:

```json
{
  "min_samples_candidates": [8, 10, 12, 15, 20],
  "sensitivity_percentages": [-20, -10, 0, 10, 20],
  "eps_candidates_km": null,
  "use_default_grid": true
}
```

- Empty explicit epsilon input is sent as JSON `null`.
- `use_default_grid` is controlled by the form (enabled by default).
- Explicit epsilon candidates are passed through as entered.
- Frontend does not round, merge, deduplicate, rank, or convert epsilon values.

## Backend-owned calculation metadata

The UI reads and displays, when present:

- `k_distance_percentiles_km.p90`, `.p95`, `.p98`
- `percentile_method`
- `knee_input_cutoff`
- `knee_input_point_count`
- `knee_index` (1-based index in the original curve)
- `knee_detected`, `knee_detection_error`, `eps_knee_km`
- `epsilon_rounding_km`, `combination_mode`
- `earth_radius_km`, `metric`, `method_version`
- `eps_candidates_km`, `eps_sources_by_km`, `knee_not_found`

K-distance detail supports either preview point objects/tuples or a numeric `k_distance_km` array. Large arrays are visually decimated for chart rendering only; original rank values are retained for the plotted x-axis and knee marker.

## Experiment metadata

If returned by the backend, the experiment table displays:

- `eps_km`
- `eps_radian`
- `eps_sources`
- `epsilon_rounding_km`
- `method_version`

The frontend displays `eps_radian` as returned and never derives it from `eps_km`.

## Historical compatibility

All added fields are optional. Missing values in historical experiment/curve records render as `—` or are omitted. Existing endpoints and existing response fields remain supported. Backend remains the source of truth for all parameter-search calculations.
