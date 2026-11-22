# SEISMAP Frontend v0.4.22

## Realtime page refinement
- Keep the realtime map component mounted while switching BMKG feed categories.
- Retain the previous map content while an uncached category is loading; show loading feedback in the content panel.
- Use cached category data immediately when available.
- Improve realtime table readability, semantic headers, and horizontal scrolling on small screens.
- Keep the existing API endpoints and five-minute refresh interval unchanged.

## Scope
- Frontend only. No backend/API contract changes.
