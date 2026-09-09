# Case workspace

Open **Create / edit case** beside the main editor's Generate button. The workspace
keeps a separate draft; the main editor retains its generation preference.

See [CAD workspace and footprint library](CAD-WORKSPACE.md) for the tree, canvas,
inspector, reusable footprints and model alignment. The case tools below remain
available in the contextual inspector.

1. **Layout:** choose a generated or imported KiCad PCB, or a mechanical board
   reference from the layout. Choose the mounting system, supplier preset and
   construction here. A layout reference requires a switch family; it has no
   electrical routing. Separate split halves into separate cases. The profile
   thumbnails and dimensioned mounting plan work before a valid solid exists.
   Existing generated PCBs are selected automatically for new cases. The setup
   shortcut opens optional footprint/model preparation without an import round trip.
2. **Manufacturing:** new cases use the versioned JLCCNC aluminium 6061 preset.
   Override CNC or FDM settings per shell, plate and optional middle frame.
   The preset separates supplier capability figures from application defaults.
   Cutter reach follows cavity depth. Switch openings use explicit corner relief
   that retains their nominal engagement dimensions.
3. **Mounting:** selection creates contacts or supports and separate closing
   screws. Enter a **Mount / gasket count** to spread contacts over eligible
   edges, including manual contacts in that count. Leave it blank for 40 mm
   spacing. Unplaceable counts are reported. Redistribute changes only automatic
   entries; case-closing screws remain separate.
   Click an edge to add, drag a contact along it, or select a feature to edit its
   dimensions and offset. Arrow keys move a focused feature; Delete removes it.
   The popover also offers Duplicate. Undo restores the previous draft change.
   Coordinate forms remain under **Advanced / Manual**.
4. **Enclosure:** **Shell split height** measures the joint above the unrotated
   datum; **Alignment joint** chooses flat mating faces or a registration lip.
   The section sketch identifies the floor, PCB, plate and shell split. The top
   cover conceals gasket contacts; a middle frame adds a separate manufactured
   part. The switch plate remains separate.
5. **Components:** inventory honours footprint position, rotation, board side
   and population status. Known switch definitions supply starting envelopes.
   Repeated footprints are grouped; dimensions and manual model assignments can
   apply to matching footprints or just the selected instance. Unknown component
   dimensions remain optional warnings: generation is allowed, but their
   clearance is not validated. Import STEP, STL or KiCad
   VRML individually or in a project ZIP, select the matching footprint, then
   confirm scale, orientation and offsets. A linked opening follows its component.
   Enter measured keycap envelopes to validate skirt clearance; missing keycaps
   remain an explicit warning.
6. **Hardware:** existing PCB mounting holes take precedence. Proposed PCB holes
   appear in the 2D plan and require explicit inclusion or rejection. Copper, keepouts and
   board edges are checked before a board copy changes. Unsupported copper
   graphics prevent a positive hole-clearance result. No pads, nets or tracks
   are removed. Case closures start with M3 tapped receivers, separate clearance
   bores and screw-head access.
7. **Generate:** build the current captured draft, board, injections and model
   revisions. Editing, moving between steps, dragging and preview displacement
   do not compile solids. Failed or obsolete responses cannot replace a current
   result. **Restart worker and retry** preserves the draft.
8. **Review:** inspect assembled, section, exploded and individual-part views.
   A 3D feature selection opens its 2D editor. Floating clearance allowances move
   the plate, PCB and attached components together; the shells remain fixed.
   Preview sliders start at zero and do not change those allowances. Apply and
   Download require a successful generation of the current revision.

Apply reuses the generated result and makes one undoable YAML change. Cancel
leaves the saved configuration alone. Reopening restores declarations and model
assets. A changed edge reference requires repair; manual placements never move
silently after a profile change.

## Files and manufacturing information

Models live in browser IndexedDB, separately from YAML. Project ZIPs contain
`config.yaml`, `case-assets.json`, reusable files under `assets/`, STEP/STL parts,
plate SVG/DXF, the named STEP assembly and manufacturing findings. Portable
KiCad model copies live beside the exported boards under `models/`. STEP remains
STEP; STL associations use converted VRML for KiCad. Model rotations follow
KiCad's clockwise XYZ convention. Model scale is millimetres per source unit.
Nonuniform model scales use a 0.01 mm faceted reference in the case assembly;
the original STEP asset and the board's exact transform remain in the project.

The preset is `src/utils/jlccnc-6061-2026-09.json`. Supplier sources:
[JLCCNC design guidance](https://jlccnc.com/help/article/cnc-machining-design-guideline)
and [JLCPCB capabilities](https://jlcpcb.com/capabilities/pcb-capabilities).
The application starts with 3 mm walls, a 2 mm floor, 0.5 mm cavity clearance,
2 mm gasket pads at 20% compression, and 0.2 mm vertical / 0.1 mm lateral travel.
Imported board thickness overrides the 1.6 mm fallback. The board inventory
records regular routed outline and thickness tolerances and includes them in
PCB-to-shell clearance checks.

Thread metadata specifies tapping; STEP does not contain helical threads.
Manufacturing findings cover geometry and declared tool access. Holder, fixture,
cutting strategy, slicer and physical-fit checks remain separate.

## Implementation and local verification

`useCaseAnalysis` runs outline and inventory analysis; `useCasePreview` owns an
explicit solid-generation worker. Each request captures source, injections and
assets, with request identity and revision checks. `ConfigContext.adoptGenerated`
adopts the captured result after Apply without scheduling another compilation.
The engine publishes inventory before enclosures, then exports PCB copies after
outline publication. Legacy generation results and YAML remain supported.

Run `NODE_OPTIONS=--no-experimental-webstorage pnpm run test:unit` on Node versions
that expose experimental Web Storage globals. Use `pnpm run build` and
`pnpm exec playwright test` for the production bundle and browser checks.

The preview deployment path `/ergogen-gui-preview/`, storage and caches remain
separate from production. Build with `GITHUB_REPOSITORY=runinit/ergogen-gui-preview`
to check it locally. The CAD binary is cached after first generation for offline
use. Publication is separate from this local implementation.

Review groups findings by category and exposes affected feature links. Layout
keeps setup controls visible instead of repeating every component warning.
Mount-only edits reuse resolved contours in the analysis worker; board, layout,
component and asset changes invalidate that cache. Solid generation remains
explicit.
