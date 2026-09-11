# Layout editor QA

September 10, 2026

## Evidence and comparison

Source visual truth: the user's toolbar screenshots and the captured existing
[Columns workspace](docs/design-qa/2026-09-10/before.jpg).
The requested changes intentionally replace the stacked toolbar with a floating
pill and reduce tree density; this is a refactor of the existing design system.

[Final workspace](docs/design-qa/2026-09-10/after.jpg): both full-view images were
opened together for comparison at 1280 × 720 CSS and image pixels, density 1.
Both use the unchanged bundled Columns YAML, all four keys selected through their
matrix, top view, Fit, closed quick controls, dark theme and the same inspector.
No density resampling was needed. Increased drawing space and larger fitted keys
are intended; authored geometry did not change.

The [expanded controls before refinement](docs/design-qa/2026-09-10/quick-before.jpg)
and [final expanded controls](docs/design-qa/2026-09-10/quick-after.jpg) were also
compared together at 1280 × 720. Focused review covered the pill, field labels,
close control, selection visibility and tree rows. Earlier interaction fixtures
included an extra encoder and moved keys; those geometry differences are excluded
from the control comparison.

[Phone before](docs/design-qa/2026-09-10/phone-before.jpg) and
[phone after](docs/design-qa/2026-09-10/phone-after.jpg) use 390 × 844 CSS and image
pixels, density 1, with the same selected column and expanded controls. The
viewport override was reset after testing. Full captures make the control text
legible; additional raster crops were unnecessary.

## Findings and fixes

- P2, expanded panel: its original 420 px width covered the selected column.
  Narrowed it to 320 px, condensed its header, and moved it into free canvas space
  when available. The final capture leaves the selected column visible.
- P2, phone controls: the zoom pill overlaid form actions and Generate overflowed
  the header. Corrected stacking and allowed header actions to wrap with compact
  icon buttons. The final phone capture shows accessible actions without clipping.
- P2, keyboard focus: the browser's default SVG outline scaled with board units.
  Replaced it with a dashed stroke that retains its screen size. Automatic edits
  keep canvas focus; explicit keyboard invocation focuses the panel. Escape closes
  it from either location.

No actionable P0/P1/P2 visual findings remain in this scope. A phone uses a
scrollable bottom sheet; it intentionally covers part of the drawing until closed.

## Required visual surfaces

- Typography: existing Roboto family, weights and hierarchy retained. Tree captions
  are shorter and use the existing small text token; full names remain accessible.
- Spacing: 212 px tree, compact desktop rows, floating 44 px controls and a distinct
  zoom pill. Labels and actions fit the verified desktop and phone widths.
- Colors: existing dark backgrounds, green selection and blue/yellow geometry
  tokens retained. No new palette or replacement component imagery.
- Assets: existing Lucide icons and actual resolved SVG geometry. No fabricated
  images or geometry used as product decoration. Captures are unedited JPEGs.
- Copy: Objects, Columns and Matrices are first-level selection tools. Controls
  name their scope; splay, stagger, offsets and component gap use explicit units.

## Interaction and code checks

Browser checks in the Codex in-app browser:

- Direct component drag commits and retains its position through layout refresh.
- A snapped component retains a 2 mm edge gap, target `inner_home` and relative X
  offset 14 mm. The SVG viewBox remains unchanged across that drop.
- Ctrl toggles objects/columns; Shift selects the complete ordered range.
- Delete removes two selected keys together; one Undo restores them. Delete inside
  a numeric field edits text without deleting objects.
- Selection opens relevant object, column and matrix controls after release.
- Escape dismisses automatic controls; Shift+F10 opens and focuses quick controls.
- Tree selection, scoped controls, Fit and responsive header/panel access work.

Automated checks: 657 tests across 96 files, TypeScript, ESLint, Markdownlint and
Knip pass. Production build passes. Tests use
`NODE_OPTIONS=--no-experimental-webstorage` for this host's Node runtime; without
it, Node's experimental storage masks jsdom storage in unrelated existing tests.
Regression tests cover retained drop geometry, camera stability, cancelled/error
retry state, aliases/relative frames, ownership, mirrored selection, batch
removal, locks, references, unequal pitch, oversized keys and pitch expressions.

Console inspection found the unchanged legacy `require('makerjs')` startup error
in `index.html`, plus a Monaco cancellation while reopening Code during hot reload.
No new layout interaction exception appeared in the final checks. Existing
third-party build warnings remain, including bundle size and WASM module shims.
These checks do not establish PCB routing, 3D enclosure fit or fabrication readiness.

## Result

final result: passed
