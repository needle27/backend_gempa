# SEISMAP Frontend v0.4.28

## Sidebar vertical anchor fix
- Lock desktop sidebar to the same sticky viewport anchor on every admin route.
- Set the admin grid alignment to start so content height cannot vertically stretch/center the sidebar.
- Explicitly clear top margin and transform from the sidebar anchor.
- Preserve existing desktop widths, menu dimensions, and mobile navigation rules.
- No API/backend changes.
