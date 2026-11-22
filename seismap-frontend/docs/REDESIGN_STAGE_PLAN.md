# SEISMAP Full Frontend Redesign Plan

Scope: public pages + Admin pages. Visual direction: comprehensive redesign while retaining SEISMAP navy, slate, cyan, and blue identity.

## Stage 1 — Shared design foundation (v0.4.36)
- Semantic design tokens.
- Shared surfaces, cards, headings, buttons, inputs, tables, status and state primitives.
- Public/Admin shell spacing and navigation foundations.
- Keyboard skip links and accessible navigation labels.
- Reduced motion/transparency support.
- No data or workflow behavior changes.

## Stage 2 — Public experience (implemented in v0.4.37)
- Home page information hierarchy and hero.
- Cluster map controls, map frame, legend and responsive layout.
- Analysis page chart grouping and explanatory hierarchy.
- Realtime page tabs, map/list composition, table/list readability.

## Stage 3 — Admin operational pages
- Dashboard, Dataset, Validation.
- Shared forms, upload, statistics, tables and detail states.

## Stage 4 — Admin analysis and operations
- Parameter Search, Job Management, Final DBSCAN.
- Preserve scientific metadata, provenance, API response mapping, job lifecycle and polling.

## Stage 5 — History, audit and final QA
- Run History and Audit Log.
- Responsive checks at desktop/tablet/mobile widths.
- Typecheck, build, navigation, API integration and lifecycle regression tests.

## Release gate
Each stage starts from a verified backup checkpoint. A stage is not marked STABLE until local typecheck, build, and user-facing functional checks pass.
