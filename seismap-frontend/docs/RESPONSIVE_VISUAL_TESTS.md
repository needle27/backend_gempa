# Responsive & Visual QA — v0.4.5

## Viewport matrix

| Device class | Viewport to verify | Expected result |
|---|---:|---|
| Small phone | 320 × 640 | One-column statistics, no page-level horizontal overflow, readable form controls |
| Phone | 390 × 844 | Two-column statistics, one-column charts, wrapped admin navigation |
| Large phone | 430 × 932 | One-column charts, responsive map and detail panels |
| Tablet portrait | 768 × 1024 | Responsive admin navigation grid, map and forms in one column |
| Tablet landscape | 1024 × 768 | Compact sidebar or tablet layout, no clipped cards |
| Laptop | 1366 × 768 | Desktop sidebar and two-column analysis charts |
| Short desktop | 1280 × 600 | Sidebar can scroll without clipping navigation |
| Wide desktop | 1920 × 1080 | Content remains centered and does not stretch excessively |

## Pages to verify

- Public: Home, Cluster Map, Analysis, Realtime.
- Admin: Login, Dashboard, Dataset, Validation, Parameter Search, Job Management, Final DBSCAN, Run History, Audit Log.

## Visual checks

- No unintended horizontal overflow on the page.
- Tables may scroll horizontally inside `.table-scroll`.
- Charts stack to one column at widths up to 620px.
- The same cluster ID has the same color in map markers, map legend, and charts.
- Noise uses neutral gray.
- Success, warning, and error states use teal, amber, and rose respectively.
- Focus indicators remain visible for keyboard users.
- Touch controls are at least 44px where practical.
- Reduced-motion and reduced-transparency preferences are respected.

## Runtime verification still required

This source-level refinement does not replace visual testing in a real browser. Verify the viewport matrix above in Chrome/Safari and check the browser console for layout or rendering errors.
