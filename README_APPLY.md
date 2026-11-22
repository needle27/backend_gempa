# BE 4.1 — Remove DBI/DBCV calculations safely

## Scope

This patch removes DBI and DBCV as active evaluation calculations. It keeps Haversine Silhouette, deterministic cluster-stratified sampling, and the existing evaluation service interface.

For compatibility with already stored outputs, newly evaluated results return `dbi_score=None` and `dbcv_score=None`. Existing database columns, model definitions, migrations, API serializers/routes, Job records, experiment records, run records, artifacts, memberships, and cluster profiles are deliberately left unchanged. No database connection or migration is performed by this script.

## Apply on Mac

Stop Flask/Celery with `CTRL+C`. From the BE 4.1 project root:

```bash
source .venv/bin/activate
python remove_dbi_dbcv_runtime.py
```

The script first prepares all changes in memory and syntax-checks them. If any anchor or source structure does not match, it aborts without changing project files. After successful preflight it creates a timestamped backup in the parent directory and applies the patch.

## Verify

```bash
python -m compileall -q services tests
python -m pytest -q
```

Do not run migrations or create a new processing Job as part of this cleanup.

## Expected grep results

Some `dbi_score` / `dbcv_score` references intentionally remain in models, migrations, and API serializers. They are legacy output fields needed to read historical results and preserve the API contract. They are not calculation code. The runtime evaluator and its configuration must no longer contain DBI/DBCV algorithms or `DBCV_MAX_SAMPLE`.
