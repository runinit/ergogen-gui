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

## September 11, 2026 — Inspector and resize clearance

The inspector starts closed and combines Objects, Selection and Design. Unit
regressions verify selection does not open it, section state survives closing,
and Escape restores focus. The old selection popup and its callbacks are removed.

Resize tests cover outside and interior columns, individual keys, whole matrices,
height, explicit alignment, splay, stagger, offset expressions, grow/shrink,
authored compensation edits, locks added after resizing, locked attachments,
mirrors, constraints, external keys and undo/redo. Native generation verifies the
7×5 plus 2×2 fixture's automatic outline contains the resized keycaps. The fixture
uses an explicit bridge between matrices, as required by native outlines.

Production Vite bundling succeeds using installed dependencies. The full build
lifecycle cannot refresh footprint sources because GitHub DNS is unavailable.
Desktop/mobile Playwright coverage is added in `e2e/inspector-resize.spec.ts`;
browser acceptance remains pending because the sandbox rejects socket creation
and the Playwright preview server cannot start. No new screenshots were captured.
The design detector reports only the existing selected-row and stage-tab borders.

### Deployment acceptance

With network and browser access restored, the full build lifecycle succeeds.
Precommit passes 702 unit tests; release checks pass 10 tests. The Chromium suite
passes 58 tests with its existing GitHub URL-loading test skipped. Desktop and
mobile Inspector tests also pass with explicit first-column selection, delayed
analysis, unchanged neighbouring keys and camera, completed layout analysis,
Escape/focus restoration, and undo/redo.

Live testing exposed duplicate selection controls and a mobile close-button
overlap. The shared inspector now renders one set of controls, and its sheet
sits above the canvas tools. Screenshots are saved under
`docs/design-qa/2026-09-11/`.

Preview deployment `ad6b4ee` completed successfully through GitHub Actions run
`34651881304`. The hosted site at
<https://runinit.github.io/ergogen-gui-preview/> passed all three desktop/mobile
acceptance tests after publication. GitHub independently passed 702 unit tests
and 58 browser tests (one existing skip).

## CAD drafting console redesign — 2026-09-11

The confirmed direction unifies Board Studio and the part editor with graphite
surfaces, blue selection, compact controls, and matching pane widths. Desktop
keeps the object browser and properties beside the drawing. Phone drawers fill
the workspace and retain a sticky selection summary or part save/undo header.

Model fields retain incomplete numeric input until blur or Enter; Escape restores
the value. Bundled parts retain separate drafts and undo history when browsing,
and the part editor survives navigation back to the board. Bundled sources stay
unchanged until an editable override is saved.

### Evidence

- [Board workspace](public/images/changelog/cad-redesign/desktop.png).
- [Part editor](public/images/changelog/cad-redesign/parts.png).
- Desktop (1440×1000), mobile (390×844), and narrow (320×844) captures and
  measurements: `.impeccable/review/`. All three sizes report no document
  overflow or browser page errors. The part capture uses the repository's
  C_0603_1608Metric footprint/STEP fixture with model Z offset set to 1 mm.
- Fresh finish review: **ship** after one correction batch. All five findings
  resolved: full phone drawers, clear panel anchoring, sticky selection context,
  long-name handling, and accessible compact header controls.
- Both included documentation screenshots include embedded source provenance;
  the provenance scan reports two rasters and zero missing entries.

### Validation

- Full build lifecycle passed; production bundling passed again after the final
  drawer changes. Existing CAD dependency bundling warnings remain.
- Full unit suite: 703 tests in 100 files passed. After the final drawer changes,
  the affected BoardStudio/ModelEditor suites passed again (22 tests).
- Nineteen browser scenarios passed across the workbench, footprint library,
  inspector resizing, native layout, responsive, and studio workflow suites.
  The first broad run found two obsolete accessible-name expectations; updated
  selectors passed on rerun. Final drawer coverage includes 320/390px widths,
  long part names, visible close/header controls, and no horizontal overflow.
- TypeScript, scoped ESLint, Knip, scoped Prettier, and `git diff --check` passed.
- The single design-detector pass found only the old DESIGN.md palette snapshot;
  the finish documentation refresh records the implemented colors.

Validation used local production builds in fresh headless Chromium contexts.
This redesign has not been deployed; these checks do not establish enclosure fit
or manufacturing readiness. Unrelated working-tree changes were preserved.

## September 12, 2026 — Units, relationships and docked setup

Implemented in the enclosure-work checkout, preserving the approved CAD console.
New boards start empty with explicit pitch and mechanical parameters. Stagger,
shared increments, physical centers and optional persistent relationships work in
Layout. Design setup stays docked and stages edits without replacing the layout.

Evidence in [layout-usability](docs/design-qa/layout-usability): desktop setup,
assembly, stack, stagger, alignment, named material section and independent material
export; 320px and 390px setup, assembly, stack and canvas captures. All are direct
Playwright viewport captures from the production build in fresh browser contexts.

The fresh Impeccable finish reviewer returned **ship** on its verdict pass: all
three listed fixes resolved. Those fixes covered mobile assembly reachability,
separate gap-fit/cutting readiness copy, and named material layers with independent
export states. This verdict scores that finding list. The fresh documenter updated
DESIGN.md, the token sidecar and the surface brief while preserving the incumbent
world.

Validation:

- 722 GUI tests pass across 106 files; TypeScript, scoped ESLint/Prettier and Knip pass.
- Seventeen browser scenarios pass across focused runs: six new layout/setup/material
  scenarios, nine existing workspace/library/resize regressions and two onboarding
  checks, including the KiCanvas PCB preview. The matrix fixture now explicitly
  adds its 5 × 4 matrix after empty-board setup.
- Native engine: 280 pass, 18 DXF fixture failures. The untouched Git baseline has
  the same 18 failures under the same dependencies (273 pass). This is not a clean
  engine-suite result.
- Selected engine archive SHA-256: `944c5d0dff46c99013d77a225115f3f602292a34211ae6df416767238ed642ea`.
  All 75 archived runtime source files match the local engine checkout.
- Browser-downloaded two-key sample parsed successfully in `kicad-cli` and produced
  a PCB-area SVG with both switch/diode footprints and the closed outline.
- Downloaded foam DXF declares millimetres: one closed outer perimeter and four
  closed key cutouts, with bounds -11 to 30.05 mm on both axes. ZIP metadata retains
  stock/installed thickness and per-layer status. Interfering silicone stays
  disabled while fitting foam and the PCB remain downloadable.
- Native tests confirm independent material contours, compressed sheet ordering,
  missing-surface isolation and nominal reference-solid volume.

Regression-first checks reproduced invalid alignment feedback, unlink pose loss,
and missing initial PCB outlines before fixes. The first populated PCB regression
also caught small diode regions failing gap closing; closing now applies to key
regions. A mouse drag test was corrected to target the center inside its
zoom-dependent snap radius.

The sample is unrouted. Material solids are nominal references; these checks do not
establish physical compression behavior, enclosure clearance or fabrication readiness.
No deployment or commit was requested. Unrelated dirty work remains intact.
