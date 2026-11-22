# SEISMAP Frontend v0.4.35

## Admin UI consistency and checkpoint workflow
- Fixed active navigation indicator: it now follows the active NavLink rather than remaining statically attached to Dashboard.
- Refined shared Admin shell surfaces, navigation interaction, focus-visible states, card borders/shadows, and responsive spacing using existing SEISMAP navy/slate/cyan/blue tokens.
- Preserved the v0.4.34 Parameter Search visual refinements.
- Added a Git-free checkpoint script for stable/development backups, listing backups, and safe rollback.
- Rollback preserves the failed/current project in a timestamped sibling folder.
- No API services, request payloads, DBSCAN calculations, evaluation/recommendation logic, polling, or job lifecycle behavior changed.
- Public pages and page-specific business logic were not modified.
