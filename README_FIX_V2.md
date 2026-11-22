# Backend test fixture correction — v2

Replace only `tests/integration/test_admin_support_routes.py` in the BE 4.1 repository with the file in this package.

This update preserves the previous noise-percentage correction (`100.0 / 6.0`) and fixes the next test-fixture failure:

- `DBSCANRun(status="SUCCESS")` must have `completed_at` set.
- The database constraint `ck_run_success_requires_results` explicitly requires non-null `completed_at` for a successful run.
- The fixture now sets `completed_at=datetime.now(timezone.utc)`.

No production model, database constraint, migration, DBSCAN algorithm, or real dataset is changed. This is a test-only fixture correction.

From the BE 4.1 repository root, apply by extracting this ZIP and replacing the test file, then run:

```bash
python -m pytest -q \
  tests/unit/test_bmkg_realtime_service.py \
  tests/unit/test_bmkg_tsunami_mapping.py \
  tests/integration/test_admin_support_routes.py
```

This archive has been checked for Python syntax and contents only; it has not been executed against the user's local BE 4.1 environment.
