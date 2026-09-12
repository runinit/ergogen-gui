---
version: 1
slug: "src-molecules-boardstudio-tsx"
primary_target: "src/molecules/BoardStudio.tsx"
related_targets: ["src/molecules/FootprintLibrary.tsx","src/molecules/ModelEditor.tsx","src/molecules/StudioStyles.tsx"]
---

# CAD workspace

Mode: Operate. Scope: Board Studio, object/component placement, part library, and model editing. Keep native generation, imports, exports, project history, and bundled/custom ownership intact.

## Direction contract

THESIS: One CAD drafting console connects the object browser, geometry, and editable properties. Remove disconnected floating inspectors and crowded, competing toolbars.

OWN-WORLD: Cool graphite panels, restrained blue selection, quiet rules, workhorse Roboto type, aligned numeric readouts, compact rectangular controls. The dark field continues the user's established editing environment.

STORY: Choose an object or reusable part, inspect it in the central field, edit its properties, and retain context when changing tasks.

SETUP: DesignSetupPanel, DimensionField, StackupPanel, SnapControls, and RelationshipPanel extend the same console into setup and mechanical review. Quarter-unit editing and physical center snapping stay visible. On mobile the embedded assembly section remains reachable in document order; named material layers expose their own fit status, while cutting and export readiness remain separate.

FIRST VIEWPORT: A compact project header and stage strip sit above a left object browser, dominant central drawing, and right properties pane. Part save/undo remain at the inspector top. Narrow layouts expose one labelled drawer at a time. Primary generation stays in the project header.

FORM: CAD drafting console, grounded candidate 1, chosen model-pick from seed 44dfdd4f. Code-first. Signature interaction: selection changes the properties without replacing the canvas or losing an unsaved part draft. Motion: brief ease-out pane entry, stable controls during updates, reduced-motion fallback.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
