---
name: 'Ergogen CAD Drafting Console'
description: 'A compact graphite and blue workbench for keyboard design editing.'
colors:
  primary: '#326b85'
  primaryHover: '#3b7c99'
  accent: '#79b7d4'
  background: '#20252b'
  backgroundLight: '#282f37'
  backgroundLighter: '#343d47'
  border: '#424d59'
  borderHover: '#667788'
  buttonHover: '#35414d'
  fieldSurface: '#20262d'
  text: '#e1e8ee'
  textDark: '#c0ccd6'
  textDarker: '#a5b3c0'
  white: '#fff'
  selected: '#293f4d'
  grid: '#303942'
  key: '#c7d5de'
  outline: '#79b7d4'
  component: '#c3a96c'
  error: '#ff6d6d'
  warning: 'hsl(45, 100%, 90%)'
  warningDark: 'hsl(32, 79%, 40%)'
  info: 'hsl(206, 94%, 92%)'
  infoDark: 'hsl(206, 100%, 30%)'
  success: 'hsl(120, 73%, 92%)'
  successDark: 'hsl(120, 50%, 35%)'
typography:
  body:
    { fontFamily: "'Roboto', sans-serif", fontSize: '14px', lineHeight: 1.45 }
  title:
    { fontFamily: "'Roboto', sans-serif", fontSize: '18px', fontWeight: 700 }
  label: { fontFamily: "'Roboto', sans-serif", fontSize: '13px' }
  code:
    {
      fontFamily: "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
    }
rounded: { field: '5px', tool: '8px', case: '8px' }
spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem' }
studio:
  {
    setupPreviewHeight: '144px',
    expandedPreviewHeight: '320px',
    pillRadius: '999px',
  }
components:
  button-primary:
    {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.white}',
      rounded: '{rounded.field}',
      padding: '0.5rem 1rem',
      height: '36px',
    }
  button-neutral:
    {
      backgroundColor: '{colors.backgroundLight}',
      textColor: '{colors.text}',
      rounded: '{rounded.field}',
      padding: '0.5rem 1rem',
      height: '36px',
    }
  button-selected:
    {
      backgroundColor: '{colors.selected}',
      textColor: '{colors.text}',
      rounded: '{rounded.field}',
      padding: '0.5rem 1rem',
      height: '36px',
    }
  input-studio:
    {
      backgroundColor: '{colors.fieldSurface}',
      textColor: '{colors.text}',
      rounded: '{rounded.field}',
      padding: '0.5rem',
      height: '36px',
    }
  stage-nav: { textColor: '{colors.text}', padding: '0.5rem 1.5rem' }
  canvas-dock:
    {
      backgroundColor: '{colors.backgroundLight}',
      rounded: '{rounded.tool}',
      padding: '0.25rem',
    }
---

<!-- markdownlint-disable MD025 -->

# Design System: Ergogen CAD Drafting Console

## Overview

<!-- markdownlint-disable MD036 -->

**Creative North Star: "The CAD drafting console"**

<!-- markdownlint-enable MD036 -->

This is a compact, practical workbench for keyboard designers. Cool graphite surfaces recede behind the drawing, while restrained blue marks the active stage, selection, focus, and primary generation actions. Roboto keeps controls workmanlike; aligned numeric fields make geometry readable at a glance.

The object browser, central geometry, and editable properties share one spatial model. Selection changes the inspector without replacing the canvas or losing an unfinished part draft. Bundled and custom parts stay distinct across Design, PCB, Case, and Export.

**Key Characteristics:**

- Graphite panels with blue selection and focus states.
- Docked browser and inspector around a dominant drawing field.
- Compact rectangular controls with numeric, tabular readouts.
- Touch-safe controls and reduced-motion support.

## Colors

Graphite provides the field and panel layers; cool blue carries action and selection. Key, outline, and component colors stay distinct inside geometry.

### Primary

- **Workbench blue** (#326b85): primary generation and commit actions.
- **Blue hover** (#3b7c99): primary hover state.
- **Draft blue** (#79b7d4): active stage, focus, selected geometry, and outlines.

### Secondary

- **Key blue-gray** (#c7d5de): key geometry.
- **Component brass** (#c3a96c): component geometry.

### Neutral

- **Graphite field** (#20252b): application and canvas background.
- **Graphite panel** (#282f37): controls, panes, and editor surfaces.
- **Graphite raised** (#343d47): higher contrast panel or hover surface.
- **Rule gray** (#424d59): borders and dividers.
- **Text** (#e1e8ee), **muted text** (#c0ccd6), **secondary text** (#a5b3c0): hierarchy.
- **Selection wash** (#293f4d) and **grid** (#303942): selected rows and canvas grid.

## Typography

**Display Font:** Roboto (with sans-serif fallback)

**Body Font:** Roboto (with sans-serif fallback)

**Label/Mono Font:** Source Code Pro, Menlo, Monaco, Consolas, Courier New, monospace for code surfaces.

**Character:** Neutral, compact, and technical. Numeric inputs use tabular numerals so changing values does not shift nearby controls.

### Hierarchy

- **Title** (700, 18px): project and pane headings.
- **Body** (400, 14px, 1.45): controls, descriptions, and editor copy.
- **Label** (400, 13px): numeric labels, helper text, and metadata.
- **Code** (monospace): source and configuration editing.

## Layout

Desktop uses a three-column drafting surface: a 240px object or part browser, a flexible central canvas, and a 320px properties inspector. A compact project header and stage strip establish project context above it. Let panes own their scroll independently.

At 1050px and below, replace docked panes with a labelled drawer; the canvas remains primary and the active drawer gets a sticky header. At 600px and below, drawers use full width and headers/actions wrap. Use the existing 0.25rem, 0.5rem, 1rem, and 1.5rem rhythm. Controls are 36px high; narrow layouts use 44px touch targets.

The embedded Design Setup flow stays reachable on mobile: setup, assembly, stack, and canvas are sequential sections in the same document. Assembly previews use 144px at rest and 320px when expanded.

## Elevation & Depth

Depth is restrained and structural. Tonal graphite layers and quiet rules define ordinary surfaces; shadows are reserved for floating canvas tools and metadata popovers.

### Shadow Vocabulary

- **Canvas tool** (`0 4px 20px #0005`): floating rail and zoom dock.
- **Metadata popover** (`0 4px 12px rgba(0, 0, 0, 0.4)`): development metadata only.

## Shapes

Use compact rectangular fields and buttons with a 5px radius. Tool docks and case surfaces use 8px. Rules are 1px solid graphite borders. Stage tabs use no radius and a 2px blue bottom rule for the current step. Preserve visible focus outlines.

## Components

### Project Header and Stage Navigation

The compact header keeps project title and actions together, followed by Design, PCB, Case, and Export. The current stage uses blue text and a blue bottom rule. At narrow widths, actions wrap and stage labels can stack.

### Object Browser and Part Library

The left dock catalogs objects, clusters, bundled parts, and editable custom parts. Rows are compact and left-aligned. Selection uses the selection wash and blue border; ownership remains distinguishable. Narrow layouts expose one labelled drawer at a time.

### Canvas and Tool Docks

The central field owns geometry and selection. The vertical rail groups object, column, matrix, pan, options, snap, and delete actions; the zoom dock sits at lower right. Pressed tools use selection wash and blue foreground. Icon-only controls retain accessible names.

### Inspector and Model Editor

The right inspector keeps selection summary, save actions, and properties visible. Part editing uses a sticky header for save and selection context. Model transforms use numeric offset, rotation, and scale fields; unfinished text commits on blur or Enter. Errors and busy states remain beside their operation.

### Design Setup and Mechanical Stack

DesignSetupPanel groups layout, key assembly, controller and power, accessories, and review while retaining canvas context. DimensionField uses quarter-unit and physical millimetre values with tabular numerals. SnapControls exposes unit steps, custom millimetres, grid, center, and edge guides; RelationshipPanel applies center alignment, center distance, and equal spacing as named constraints.

StackupPanel names each material layer and shows its independent fit status. “Fits gap” describes stack clearance only; cutting profiles and export readiness remain explicit Export concerns. Material, thickness, compression, inset, clearance, and cutouts remain editable per layer.

### Buttons and Fields

Primary buttons use workbench blue; neutral buttons use the panel surface; selected buttons use selection wash with a blue border. Fields use the recessed field surface, 5px radius, 1px rule, and 0.5rem padding. Focus uses a 2px blue outline with 2px offset. Disabled controls use 0.45 opacity.

### Status and Export Boundaries

Keep gap fit, cutting profile checks, and export readiness as separate labels and states. A named layer may fit the mechanical gap while its cutting outline is unresolved or its export is unavailable. Show the layer name and material in section and narrow-screen status rows.

## Do's and Don'ts

- Do keep the canvas dominant between the 240px browser and 320px inspector.
- Do keep save, selection, and unsaved part context visible in sticky editor headers.
- Do use 36px controls on desktop and 44px targets at the 1050px breakpoint.
- Do use tabular numerals and commit numeric edits on blur or Enter.
- Do preserve separate key, outline, component, selection, and grid colors.
- Do respect `prefers-reduced-motion`.
- Don't replace the canvas when selection changes.
- Don't turn every surface into a floating card or add shadows to ordinary panels.
- Don't merge bundled and custom ownership into one catalog.
- Don't crowd narrow layouts with simultaneous inspectors.
