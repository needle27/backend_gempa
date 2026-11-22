# SEISMAP Frontend v0.4.5

## Responsive & Visual Consistency Refinement

### Responsive layout
- Charts now use a single-column layout on mobile screens.
- Public navigation wraps instead of requiring horizontal scrolling.
- Admin navigation changes into a responsive grid on tablet and mobile.
- Statistic cards adapt to two columns on mobile and one column on narrow screens.
- Feature cards, map panels, forms, and detail sections adapt to narrow viewports.
- Admin sidebar can scroll on short desktop viewports instead of being clipped.
- Tables retain intentional horizontal scrolling inside their own container.

### Visual consistency and accessibility
- Shared glass-surface borders, shadows, and radii are standardized.
- Statistic-card accents follow consistent semantic tones: cyan, violet, teal, and amber.
- Text contrast and supporting-label sizes are improved.
- Buttons and icon controls have larger touch targets.
- Mobile form controls use a readable font size and avoid iOS focus zoom.
- Glass blur is reduced on mobile and disabled when reduced transparency is requested.

### Cluster color consistency
- Added a shared deterministic cluster palette.
- The same `cluster_id` now uses the same color in map markers, bar charts, pie charts, and map legend.
- Noise remains neutral gray.

### Preserved behavior
- No backend API contract changes.
- No DBSCAN methodology or parameter changes.
- No authentication, dataset, job, or run workflow changes.
- The v0.4.4 Final DBSCAN null-safe error message fix is included.
