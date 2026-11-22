# SEISMAP Frontend v0.4.27

## Sidebar & Admin Layout — consolidated fix
- Sidebar extracted as a memoized `AdminSidebar` and remains outside the route `Outlet`.
- Explicit `NavLink` active class for consistent active state across admin routes.
- Desktop sidebar width locked at 246px; compact desktop width follows the existing 218px breakpoint.
- Menu items share fixed 43px height, 17px icons, consistent label alignment, and one active indicator.
- Scrollbar gutter is reserved to prevent content-height differences from shifting the viewport.
- Responsive rules are ordered after desktop geometry rules; on screens <=850px the sidebar releases fixed desktop width and uses the compact horizontal navigation.
- No API, endpoint, request payload, or backend changes.
