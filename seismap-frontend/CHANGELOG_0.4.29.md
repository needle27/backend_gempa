# SEISMAP Frontend v0.4.29

## Definitive admin sidebar positioning fix
- Desktop sidebar is viewport-fixed at top/left 17px and bottom 17px, so route content height cannot affect its position or height.
- Reserve the same sidebar column in the admin grid so main content remains aligned at x=279px on standard desktop.
- Keep 246px width on desktop and 218px at 851–1100px.
- Allow independent vertical scrolling inside the sidebar only if its contents exceed available viewport height.
- Explicitly restore normal full-width horizontal-navigation behavior on mobile (<=850px).
- No API or backend changes.
