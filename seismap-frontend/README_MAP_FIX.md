# SEISMAP — Map Tooltip and Marker Layout Fix

Patch target: SEISMAP Frontend v0.4.8 (or a later source retaining the same files).

## Changes

1. Fixes Leaflet earthquake tooltip sizing. The tooltip now has a predictable responsive width, so its text no longer collapses into a narrow vertical strip.
2. Prevents arbitrary character-by-character wrapping. Long tokens may still wrap when necessary.
3. Keeps the tooltip within a viewport-aware maximum width and adds scroll-safe content containment.
4. Reduces marker radius and opacity slightly to improve legibility in dense earthquake areas.
5. Enables Leaflet's Canvas renderer preference for better rendering performance with large marker sets.

## Apply

From the `seismap-frontend` project root, copy the two files into the matching paths, replacing the existing files:

- `src/components/ClusterMap.tsx`
- `src/styles/leaflet.css`

Then run:

```bash
npm run typecheck && npm run build
```

No backend, database, API contract, route, or dependency changes are included.
