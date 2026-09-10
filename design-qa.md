# Board Studio design QA

September 10, 2026. Verified locally in the Codex in-app browser.

## References and comparison

- Selected reference: `/home/chris/.codex/generated_images/01a084a1-56d9-7a72-976e-2566d7078900/exec-22449fc6-68d0-4ac2-85f4-580d26f613fb.png`.
- Interaction reference: [Cosmos editor](https://ryanis.cool/cosmos/beta), reached
  from the supplied [repository](https://github.com/rianadon/Cosmos-Keyboards).
  Captured and inspected its matrix controls. No code or assets copied.
- Compared the selected reference and final BHK capture in the same image input:
  Layout, thumb cluster selected, 1487 × 1058 CSS viewport.
- Final desktop captures use 1.5 capture scale; phone uses a 390 × 844 CSS viewport.
  Earlier captures with incorrect emulation scaling were discarded.

The final layout retains the selected reference's workflow, three-panel hierarchy,
dark surfaces and green selection. Existing fonts and theme tokens remain. Real
BHK envelopes replace illustrated components and preserve its five free thumb
keys; the mock's three-key arc is not BHK data. Solid views remain in Case.

## Resolved findings

- Removed the desktop mobile-panel toolbar and grouped the tree's components/layers.
- Reduced selected-tree brightness and restored update/install actions.
- Added numeric matrix dimensions and explicit Keys / Columns / Clusters scope.
- Wrapped the phone header and kept the canvas visible above editing sheets.
- Kept drag feedback out of document flow. A horizontal phone drag now changes
  X only; one Undo restores both coordinates. The original browser assertion failed.
- Mounted new matrices, thumb clusters and loose keys on their PCB support layer.
- Validated rounded contours and collapsed sub-tolerance offset remnants before
  CAD conversion. Captured matrix cavity, ring and roof regressions now pass.

## Verified workflows

- Create a 5 × 4 matrix: 20 keys, PCB top layer and automatic row/column nets.
- Select a column on canvas; change splay, stagger, offsets and pitch expressions.
- Remove/restore a cell; resize without restoring intentionally removed keys.
- Rotate a key; Undo/Redo restores source and geometry.
- Named dimensions drive constraints. Disabling a required solve coordinate
  reports a conflict; Undo restores the solved layout and retains formulas.
- Case edits persist when switching stages. Project assets, source and custom
  footprints share history; session tests cover import races and project copies.
- Current PCB/outline exports and source sharing work; stale results cannot export.
- Phone selection opens its inspector. Pan, zoom, Fit and horizontal dragging pass;
  DOM measurements show no horizontal overflow or clipped canvas.
- Fresh matrix and BHK generation render real solids with zero case blockers:
  matrix 20 components / 4 checks; BHK 39 components / 8 checks.
- Final browser log review reports no runtime exceptions or error entries.
  Earlier deliberate invalid constraint/geometry inputs produced expected errors.

## Evidence

- [Matrix desktop](public/images/changelog/studio-matrix-desktop.png)
- [Matrix phone](public/images/changelog/studio-matrix-phone.png)
- [BHK layout](public/images/changelog/studio-bhk.png)
- [Matrix enclosure](public/images/changelog/studio-matrix-case.png)
- [BHK enclosure](public/images/changelog/studio-bhk-case.png)

## Automated checks and limits

- Engine: 291 tests; schema generation and bundle build pass.
- GUI: 536 tests across 76 files; formatting, ESLint, Markdown lint, Knip and
  TypeScript checks pass. Nine release checks and production/preview builds pass.
- All 73 installed engine source files match the enclosure checkout.
- Existing React act warnings and dependency/bundle warnings remain non-failing.
- Pinch is implemented, but this browser's automation cannot dispatch touch events;
  physical-device pinch was not verified. No external browser test runner was used.
- Generation and visual checks are not fabrication or physical-fit approval.
  Missing BHK component envelopes still require measurement. Large inter-key gaps
  need an appropriate region gap-closing value or an authored bridge.

final result: passed

## Cluster editing regression checks

September 10, 2026. In-app browser, isolated development draft.

- Created a 7 × 4 matrix, then a thumb arc and a separate 3 × 2 matrix.
- Added objects remained visible and movable during board outline errors.
- Pointer dragging and keyboard nudging moved every key in the selected matrix.
- Deleted populated and empty clusters; Undo restored members.
- Rebuilt the existing outline, then deleted and restored a connected cluster.
  Both states resolved with zero checks; generated bridges followed deletion.
- Selected MX 2u and changed custom depth: the canvas measured 37.05 × 27 mm.
  MX 1.25u also updated the selected key without changing its switch opening.
- Inspected nested columns and keys with independent expansion.

[Repaired cluster tree](public/images/changelog/studio-cluster-repair.png)

Regression validation: 547 GUI tests across 77 files, typecheck, lint, Knip and
nine release checks pass. Browser error review found no runtime exceptions.

Keycap presets are nominal envelopes, not manufacturer fit measurements.

## Selection editor and key options

September 10, 2026. In-app browser, owned validation draft.

- Outside-column resizing preserves the outside edge; explicit horizontal and
  vertical alignment overrides it. Existing offsets survive relative edits.
- A +2 mm key adjustment moved its rendered polygon exactly 2 mm.
- Column adjustments set splay to 5 degrees and stagger to 2 mm across its keys.
- Matrix defaults enabled LEDs; adding a row produced seven keys with both diode
  and LED bindings. The resulting 38-key draft resolved with zero checks.
- The contextual editor opens explicitly, dismisses before canvas interaction,
  and keeps its close button visible while scrolling.
- At 390 × 700, document width remains 390 px and the editor stays above the
  inspector. Its fields and internal scrolling remain usable.
- Native PCB compilation verifies switch, diode and LED footprints with distinct
  per-key nets. LEDs require PCB DIN/DOUT connections; no autorouting is claimed.
- 559 tests across 81 files, typecheck, lint, Knip and nine release checks pass.
  Existing non-failing React/dependency warnings remain.

[Desktop editor](public/images/changelog/studio-selection-editor.png) ·
[Phone editor](public/images/changelog/studio-selection-phone.png)

These are footprint-placement options; no measured diode/LED enclosure bodies or
manufacturing-fit approval is implied.

## Release validation — September 10

- Engine: 291 tests pass at `44bbc26`.
- GUI: 599 unit tests and 10 release checks pass; production build succeeds.
- Browser: 51 checks pass across the full run and the corrected GitHub-loading
  regression; one existing skipped test remains. Coverage includes desktop/mobile
  gaskets, BHK CNC geometry, portable models, offline setup and first-use PCB viewing.
- A held mock response makes the loading-indicator assertion deterministic.
- Precache includes bundled component assets and the revisioned PCB viewer.
- These checks establish software behavior, not enclosure fabrication approval.
