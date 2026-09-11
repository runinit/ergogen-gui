# CAD workspace and footprint library

Native projects follow **Design → PCB → Case → Export**. Place keys and components
in Design and open **Part library** for reusable footprints and models. **Code**
opens the source. Settings preserves the active workspace, selection and camera.
Legacy projects retain **Create / edit case** and **Footprint library** beside
the editor.

## Case workflow

1. Open **Case** and choose **Create case** if the project has no enclosure.
   Select a shell, plate, PCB, footprint group, placement or mounting feature.
   Tree and canvas selections share the inspector. Expand a footprint group for
   individual placements; eye buttons control visibility.
2. Prepare footprints and models in the library, or set a placement override in
   **Components**. The alignment inset uses the selected footprint's geometry.
3. Inspect the 2D plan, assembled, exploded, section or isolated part view.
   Selection, visibility and model transforms update without rebuilding solids.
4. Press **Generate**. Review blockers and incomplete clearance checks separately.
   An affected-feature action selects the target and opens its repair controls.
5. Review dimensions and manufacturing findings, then open **Export** to confirm
   the current geometry and download its case ZIP. Edits invalidate confirmation;
   failed generation retains the last valid preview. Source and valid PCB exports
   remain available. Standalone legacy drafts retain Apply and case downloads.

Existing profile, mounting, hardware, manufacturing, keycap and assembly controls
remain under **Case tools**. Choose an existing PCB outline when the layout-based
boundary does not enclose the board. Automatic mounting retains pinned features.
Property changes and applied YAML edits have draft undo. Expressions, inheritance
and surrounding comments are retained. Narrow screens use tree/catalog and
inspector drawers; Escape closes a drawer and keyboard navigation remains available.

## Reusable footprints

Search bundled, project and saved user footprints. Customizing a bundled entry
creates a separate user entry. Library changes remain drafts until **Save
footprint**; the adjacent count shows linked placements and projects.

A saved entry has a UUID, immutable injection alias, source, revision, net mapping,
model bindings and cached assets. Explicit identity markers link projects; names
alone never establish a link. Saving updates linked projects locally and invalidates
previews. Instance parameters and explicit model overrides remain in their projects.
An obsolete draft cannot overwrite a revision saved by another editor.

Import `.kicad_mod`, a `.pretty` directory, or a ZIP. Choose batch entries, prepare
selected files, then review each result. ZIPs may include models. Imports are
limited to 500 supported files and 50 MB of expanded content.

**Pads & nets** links the pad preview to its mapping table. Repeated pad numbers
share a net parameter; mechanical and unnumbered pads have no net assignment.
The converter retains source geometry, layers, drills, graphics, properties and
model references. Unknown metadata is retained. Unsupported placement transforms
produce explicit diagnostics instead of dropping geometry.

**Parameters & source** exposes the CommonJS module and YAML usage. Export a
footprint ZIP for use outside the GUI. Imported geometry stays fixed-size;
dimensional parameterization and reversible-footprint synthesis are outside this
version. Custom/trapezoid pad outlines use a simplified lightweight preview;
export retains their exact source geometry.

## Models and alignment

Add, replace, remove and align multiple STEP/STP, STL or VRML models. Use numeric
XYZ offsets, rotations and scale, or the matching visual controls. Coordinates use
millimetres and KiCad's model rotations; bottom-side placement flips the model
with the footprint. Legacy KiCad `at (xyz …)` offsets are converted from inches.

A footprint's existing `params` and dynamic `body(p)` remain intact. Model edits
wrap its emitted S-expression through the shared engine parser. When a generator
emits several footprints, select an unambiguous target first.

Use local files, bundles, a standard KiCad reference or a public HTTPS URL.
GitHub file links become raw URLs; GitLab links and official KiCad references use
GitLab's file API. Missing files, rate limits and browser access failures offer
retry and upload actions. A missing legacy WRL reference can be replaced with its
official STEP counterpart. Imports can be cancelled.

Successful imports retain source URLs and content hashes. Equal filenames with
different bytes have distinct identities. Generation uses cached assets; saving
never silently refreshes an upstream download. Model envelopes include all
transforms. Missing dimensions stay visibly unchecked.

## Portable projects

Project ZIPs include library bindings and resolved snapshots, model assets,
provenance and portable `${KIPRJMOD}/models/…` references beside exported boards.
Original STEP and STL files are retained; STL exports also include the existing
VRML conversion. Source-only and bulk ZIPs include cached assets too.

Open a ZIP through **New → Choose File**. Older ZIPs remain readable. A fresh
browser profile adopts its snapshots; a browser with the same library identity
uses its latest locally saved revision. Once the app is available offline, the ZIP
can be opened and generated using its cached models without upstream downloads.

Library data lives in IndexedDB for this origin. Export a ZIP to move it between
browsers or origins. Browser storage deletion removes the local library.

See [validation](CAD-WORKSPACE-VALIDATION.md) for tested artifacts and limitations.
