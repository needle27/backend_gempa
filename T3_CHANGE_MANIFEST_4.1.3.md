# T3 Change Manifest — SEISMAP BE 4.1.3

| File | Area | Change |
|---|---|---|
| `services/parameter_search_service.py` | 29–85 | Method version 4.1.3 and configurable grid/rounding settings |
| `services/parameter_search_service.py` | 87–272 | Epsilon union builder, Decimal half-up rounding, deduplication, source provenance, candidate metadata |
| `services/parameter_search_service.py` | 398–415, 435–444, 540–590 | Optional provenance input, rounded-km to radian conversion, and persistence in `evaluation_metadata.parameter_search` |
| `tasks/parameter_search_task.py` | 23–194 | Resolve union candidates, persist job metadata, log candidate/combinations count, and fail clearly on empty candidate set |
| `routes/admin_datasets.py` | 247–292, 312–368 | Validate `use_default_grid` and explicit epsilon range; freeze effective grid/rounding in job input |
| `config.py` | 25–31, 84–90 | Parse default epsilon grid, rounding step, and grid toggle |
| `services/job_lifecycle_service.py` | 34–44 | Preserve frozen grid/toggle/rounding settings on pause-resume/restart |
| `routes/admin_jobs.py` | 136–158 | Expose resolved `parameter_search_metadata` in Job detail response (additive) |
| `tests/unit/test_epsilon_candidate_generation.py` | new | Nine focused tests for union, 3-way rounding collision, deduplication, provenance, range validation, and edge cases |
| `tests/unit/test_elbow_calculation.py` | 101, 151–180, appended | Verify p95 artifacts and isolate a KneeLocator exception to one MinPts curve |
| `tests/service_functional/test_epsilon_provenance.py` | new | Verify persisted epsilon provenance, rounded km/radian consistency, and epsilon × MinPts cross product |
| `tests/service_functional/test_job_lifecycle.py` | appended | Verify frozen epsilon settings survive pause/resume/restart dispatch |
| `tests/integration/test_api_workflow.py` | parameter-search request | Verify boolean and epsilon range validation, legacy request compatibility, and Job metadata response |
| `docs/T3_EPSILON_CANDIDATE_METHOD_4.1.3.md` | new | Method, equations, configuration, metadata schema |
| `docs/FRONTEND_HANDOFF_T3_4.1.3.md` | new | Request field and frontend metadata consumption path |

## Compatibility

- Existing request fields remain supported.
- `use_default_grid` is optional and defaults to `EPSILON_USE_DEFAULT_GRID` (`true`).
- Existing response fields are unchanged; Job detail adds `parameter_search_metadata`.
- No model columns or database schema are changed.
- Job 41 and all other historical jobs are not modified or recomputed.
- Existing evaluator metadata is extended with a `parameter_search` object.
- No database migration is required.
