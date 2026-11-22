# SEISMAP Frontend v0.4.6

## Chart Tooltip & Text Containment Refinement

### Chart hover interactions
- Replaced default Recharts tooltip panels with a compact Glassmorphism tooltip shared by all chart components.
- Removed the default grey hover cursor from bar, pie, and line charts so it no longer appears as a large grey block over the plotted data.
- Added a restrained active-mark outline while preserving each cluster/category's original color.
- Standardized tooltip headings, labels, values, spacing, border, shadow, and typography.
- Added cluster-specific details for distribution and composition charts, depth-category counts and totals for the depth profile, and magnitude/depth values for profile trends.
- Missing profile values remain shown as an em dash; they are not converted into invented zero values in the trend tooltip.
- Tooltip dimensions are constrained on mobile and the chart library is instructed to keep the tooltip inside the chart view box.

### Map marker tooltip
- Reworked marker details into labeled rows.
- Added a maximum width, normal wrapping, and safe word breaking for long location names and event identifiers.
- Used automatic tooltip direction to reduce clipping near map edges.

### Text containment audit
- Added `min-width: 0` to common flex/grid content containers.
- Added safe wrapping to page headings, card headings, status messages, dynamic backend values, job details, workflow notes, legends, and other information blocks.
- Allowed long button and status labels to wrap rather than extend beyond their parent card.
- Preserved intentional horizontal scrolling for wide data tables.

### Preserved behavior
- No backend/API changes.
- No changes to DBSCAN, Haversine, clustering parameters, or profile definitions.
- The shared cluster palette remains the single source for map markers and cluster charts; noise remains neutral gray.
- No new dependencies.

### Verification notes
- All 35 TypeScript/TSX source files passed TypeScript transpilation syntax checks (0 syntax diagnostics).
- CSS brace balance passed for global and Leaflet stylesheets.
- Full `npm run typecheck`, production build, and browser visual QA require the project's dependencies and must be run in the user's local frontend environment.
