# Backend test fixture correction

Replace only `tests/integration/test_admin_support_routes.py` in the BE 4.1 repository with the file in this package.

Corrections:
- Both experiment and run fixtures compute noise percentage as `100.0 / 6.0`, consistent with 1 noise point and 5 clustered points. This satisfies the database consistency CHECK constraint (`1e-6` tolerance).
- The test-only JWT secret is longer than 32 bytes to remove PyJWT's insecure key-length warning. This does not change the backend production secret or `.env`.

Then rerun the targeted test command from the backend repository root.
