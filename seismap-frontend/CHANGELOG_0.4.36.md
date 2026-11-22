# SEISMAP Frontend v0.4.36 — Stage 1: Design Foundation

## Scope
Shared visual foundation for the complete frontend (public pages and Admin pages), preserving the existing navy/slate/cyan/blue SEISMAP identity.

## Changes
- Added semantic design tokens for surfaces, text hierarchy, borders, focus, shadows, radii, content width, and motion.
- Standardized shared card, heading, button, form control, table, statistic, status, and state-panel presentation.
- Refined public navigation/content/footer width and responsive spacing.
- Refined Admin shell surfaces, navigation active state, and content spacing.
- Added keyboard skip links and accessible navigation labels to public and Admin layouts.
- Added reduced-motion and reduced-transparency handling.
- No API, request payload, authentication, state management, DBSCAN, evaluation, provenance, job polling, or lifecycle logic changed.
- No new UI dependencies introduced.

## Validation
- Source-level review completed.
- ZIP integrity checked after packaging.
- TypeScript/build verification must be run in the user's local project environment before this checkpoint can be marked STABLE.
