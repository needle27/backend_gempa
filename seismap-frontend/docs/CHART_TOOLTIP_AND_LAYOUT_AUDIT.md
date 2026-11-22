# Chart Tooltip & Layout Audit — v0.4.6

## Tooltip standard

All Recharts components use the same compact dark Glassmorphism tooltip:

- Cluster distribution: cluster name and event count.
- Depth profile: cluster name, shallow/medium/deep counts, and their total.
- Cluster composition: cluster name, member count, and percentage of the displayed composition.
- Profile trend: cluster name, average magnitude, and average depth. Missing values display as `—`.

The default Recharts cursor overlay is disabled. This prevents the large grey vertical rectangle visible in the previous depth-profile hover state. The active bar/line marker retains its data color and receives only a subtle outline.

Tooltip content uses actual chart payload values. The UI does not fabricate missing profile metrics.

## Map marker tooltip

Marker details are displayed as labeled rows. Long location names and event IDs wrap inside a bounded tooltip width. Tooltip direction is automatic to reduce clipping near map edges.

## Text containment rules

- Flex/grid content columns use `min-width: 0` where needed.
- Dynamic text and backend-provided messages can wrap within their cards.
- Buttons and status labels can wrap on narrow screens.
- Wide data tables retain deliberate, contained horizontal scrolling.
- Chart tooltips have a responsive maximum width and cannot escape the chart view box.

## Manual browser verification checklist

Test the following after installing the patch:

- [ ] Hover every bar in cluster distribution; no grey cursor block appears.
- [ ] Hover every stacked depth segment; tooltip is compact and lists all three depth categories.
- [ ] Hover pie slices; member count and percentage match the selected slice.
- [ ] Hover both lines; missing values show `—`, not `0`.
- [ ] Hover first and last chart marks; tooltip remains inside the chart/card.
- [ ] Check map markers near each map edge; tooltip text wraps and remains readable.
- [ ] Check long dataset names, job messages, IDs, status labels, and error messages at 320px and 390px widths.
- [ ] Confirm no text crosses card borders or overlaps neighboring controls.
- [ ] Confirm table overflow remains contained inside the table scroller.

## Verification boundary

Static source checks cannot prove pixel-perfect rendering at all viewport sizes. Complete the checklist in a browser using actual API data before treating visual QA as complete.
