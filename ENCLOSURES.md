# Case designer

Open a layout, then choose **Create / edit case** beside Generate. For a complete
example, choose **BHK gasket enclosure** on the welcome page.

1. **Layout:** choose a board profile and included points. Give split halves
   separate case names, or add a bridge between connected anchor regions.
   For a layout with an existing PCB boundary, choose **Existing board outline**
   (for the BHK layout, `bhk`). Otherwise exclude detached helper points or add
   bridges. Switch-cutout points remain a separate selection; for BHK, keep
   `matrix_` and `thumbfan_` points and exclude the helper points.
2. **Manufacturing:** choose FDM or CNC for each shell and the plate. Enter
   measured machine, stock, material and tooling dimensions. The Layout step
   includes switch-cutout corner radii for machined plates.
3. **Mounting:** select tray, top, bottom or gasket. Gasket contacts generate
   plate tabs, wall pockets and support shelves; pads and sleeves are supported.
4. **Enclosure:** set continuous walls, floor, bezel, seam, typing angle and
   edge finishes. Dimensions accept your existing unit expressions.
5. **Components:** declare controller, connector, battery and other envelopes.
   Openings subtract from walls; floating components move with the plate.
6. **Hardware:** accept suggested positions or add anchored mounts. Case screws
   close the shells; plate and PCB supports follow the mounting system.
7. **Review:** inspect assembled, exploded, section and individual-part views.
   Gasket travel controls show the declared movement envelope. Click a support
   or opening to focus its form. Review findings,
   confirm dimensions, then **Apply design** or **Download ZIP**.

Apply makes one undoable editor change. Cancel discards the draft. Preview
errors retain the last valid geometry and disable Apply and Download until the
current draft succeeds. Opening the wizard again reads its editable YAML.
Comments, formulas and unrelated declarations remain in the configuration.
Custom boundary or sketch geometry is editable in the advanced editor.

The ZIP contains the configuration, plate SVG/DXF, STEP/STL parts, a named STEP
assembly, reference components and manufacturing findings. Tapped holes carry
thread metadata; no helical threads or CAM toolpaths are generated.

CNC checks report sharp pocket corners that need relief in the profile, missing
setups and insufficient reach. They do not replace tool-holder/fixture checks in
CAM. FDM checks do not replace slicing or a physical fit prototype.

## Preview deployment

The preview repository is `runinit/ergogen-gui-preview`. Its `/ergogen-gui-preview/`
asset path, storage keys and runtime caches are separate from production. A
revision badge identifies the candidate. Builds on feature branches run checks;
only the separate preview repository's main branch deploys the preview.
Production promotion remains a separate review step.

The CAD binary downloads on first case generation. After that generation has
completed under the service worker, the designer can regenerate offline.
First use without the downloaded CAD binary needs a connection.

## Implementation

`CaseWizard` edits a local source draft through the source-range helpers.
`useCasePreview` owns its worker and coalesces queued changes. The vendored
Ergogen source supplies native solids through an isolated CAD adapter. The
normal editor context receives results only after Apply. Kernel license notices
and source links ship under `public/licenses`.
