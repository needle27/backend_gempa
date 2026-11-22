# SEISMAP Frontend 0.4.0

## BE 4.1 contract integration

- Updated API client for BE 4.1 `data/meta` envelopes and Flask-JWT-Extended `msg` errors.
- Configured CSRF cookie defaults and `X-CSRF-TOKEN` handling for access, refresh, logout, upload, validation, parameter search, final run, and activation requests.
- Login now verifies the cookie session by calling `/api/auth/me` after successful login.
- Added `POST /api/admin/datasets/validate` dry-run UI and displays `persisted=false` semantics.
- Added dataset detail and run detail request integrations.
- Replaced Audit Log placeholder with filterable, paginated read-only page.
- Added optional `eps_candidates_km` and optional `sensitivity_percentages` handling; MinPts candidates remain required.
- Enforced final depth threshold condition `0 < shallow < deep`.
- Converted expected public 404 before an active run into empty public research states.
- Added request ID handling and safe JSON detail rendering.
- Corrected CSV rule copy: `lokasi` header is required, but its value may be empty.
- Added BE 4.1 contract documents and integration notes.

## Not yet runtime-verified

- Exact serializer shapes for Audit Log, dataset detail, and run detail are generic in the OpenAPI document and must be compared with live BE 4.1 responses.
- Cookie/CORS integration must be verified in a browser with matching frontend/API hostnames.
- Full `npm run build` could not be completed in the build environment because npm dependencies were unavailable; install dependencies locally and run the build before deployment.
