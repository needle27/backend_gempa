# SEISMAP Frontend v0.4.31

## Parameter Search provenance mapping
- Read the actual `parameter_search_metadata.epsilon_candidates[]` structure from job detail.
- Map each experiment's `eps_km` to the matching job candidate and display its `eps_sources`.
- Preserve precedence for nested experiment metadata and legacy experiment-level fields when present.
- Fall back to job-level `epsilon_rounding_km` / `rounding_km` and `method_version`.
- Expand job metadata types and UI with strategy, MinPts candidates, default-grid flag, and combination count.
- Document observed BE 4.1.3 response structure and exact UI fallback precedence.
- No API contract, DBSCAN calculations, validity logic, or recommendation logic changed.
