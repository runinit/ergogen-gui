# CAD workspace visual QA

Reference: [selected concept 1](/home/chris/.codex/generated_images/01a083a1-554d-7743-8120-6ee469fbfe3c/exec-ac145387-94d8-4e6c-876d-58ccef43b128.png).
Compared together with actual production screenshots at 1487 × 1058 and
390 × 844. The browser exercises real imported capacitor geometry and the BHK
fixture; screenshots contain no replacement product artwork or invented counts.

## Surfaces and states

- [BHK assembly](public/images/changelog/cad-workspace.png): assembly tree,
  selected capacitor group, contextual XYZ controls, exploded case and alignment
  inset. The footer distinguishes zero blockers from 77 incomplete checks.
- [Narrow canvas](public/images/changelog/cad-workspace-narrow.png): wrapped tabs,
  explicit drawer controls, viewport and findings remain accessible.
- [Narrow inspector](public/images/changelog/cad-workspace-inspector.png): controls
  scroll inside a drawer; Close and Escape restore focus to its trigger.
- [Reusable library](public/images/changelog/cad-footprint-library.png): searchable
  catalog, real STEP preview, transform controls and affected project counts.

## Comparison and repairs

The implemented layout follows the selected tree/canvas/inspector composition,
green selection, charcoal surfaces and magnified alignment inset. It retains the
existing application's logo, fonts, icons and controls. Actual BHK geometry differs
from the concept illustration: only assigned models render as model solids;
known component envelopes remain visibly distinct. The example is a mechanical
test fixture, not a complete modeled or fabrication-approved keyboard.

Visual review found and repaired overlapping narrow drawers, clipped group
counts, an inspector dominated by setup help, opaque unselected parts, an inset
camera fitted to invisible transform pickers, and a clipped long library name.
Setup help now collapses; selected model fields appear first; unselected solids
are translucent; inset fitting uses actual geometry; long library headings wrap.

The narrow canvas is intentionally compact, with panels in drawers. Long tree
names use ellipsis while counts stay visible and accessible names remain complete.
The existing control styling and actual geometry mean this is a functional
adaptation of concept 1, not a pixel-identical reproduction of its rendered art.

Final comparison: the long-name regression fails before the wrapping fix and
passes afterward. The refreshed library screenshot shows the complete name.
No blocking layout issue remains in the captured desktop and narrow states.

Keyboard selection, canvas/tree synchronization, actionable findings, library
save, import/export, drawer focus and offline snapshots are covered by browser
tests. See [validation evidence](CAD-WORKSPACE-VALIDATION.md) for commands and
remaining repository check limitations.
