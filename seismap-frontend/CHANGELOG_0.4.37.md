# SEISMAP Frontend v0.4.37 — Stage 2: Public Experience

## Scope
Presentation redesign of all public-facing pages while retaining the SEISMAP navy/slate/cyan/blue identity.

## Changes
- Public navigation: clearer active state, sticky desktop behavior, responsive mobile navigation.
- Home: improved hero hierarchy, KPI cards, workflow, interpretation cards and exploration destinations.
- Cluster Map: improved explainer, scope metadata, summary cards, map/side-panel proportions, responsive stacking.
- Analysis: improved methodology lead, parameter cards, profile guide, charts and profile table presentation.
- Realtime: clearer source panel, category tabs, latest-event/detail composition, data table and refresh metadata.
- Added responsive refinements for tablet and mobile widths.
- No React data logic, API services, request payloads, routing, map data, chart data, realtime polling/countdown or backend contracts changed.

## Validation
- TypeScript check run against the available dependency snapshot.
- ZIP integrity checked after packaging.
- Vite production build remains to be verified locally because the provided dependency snapshot lacks the Linux Rollup optional native binary.
