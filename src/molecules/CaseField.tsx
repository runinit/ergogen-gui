import { useId, useState } from 'react';
import styled from 'styled-components';
import { theme } from '../theme/theme';
const HelpWrap = styled.span`
  display: inline-flex;
  position: relative;
  margin-left: ${theme.caseWizard.gap};
  [role='tooltip'] {
    display: none;
    position: fixed;
    z-index: ${theme.caseWizard.hintLayer};
    min-width: ${theme.caseWizard.hintMinWidth};
    max-width: ${theme.caseWizard.hintWidth}px;
    padding: ${theme.caseWizard.gap};
    background: ${theme.colors.backgroundLighter};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.caseWizard.radius};
    font-size: ${theme.fontSizes.sm};
    font-weight: normal;
  }
  &:hover [role='tooltip'],
  &:focus-within [role='tooltip'],
  &[data-open='true'] [role='tooltip'] {
    display: block;
  }
`;
const HELP: [RegExp, string][] = [
  [
    /^mount \/ gasket count/i,
    'Requested number of assembly contacts, including manual placements. Leave blank to use 40 mm spacing. Automatic contacts spread across clear edges; case-closing screws are counted separately.',
  ],
  [
    /^add gasket/i,
    'Click a clear board edge to place a gasket contact. Drag it along the edge or edit its offset and dimensions. This does not generate solids.',
  ],
  [
    /^add mount/i,
    'Click a clear edge to place a mounting post or case screw. Its role follows the mounting system. Drag or edit the placement before generating.',
  ],
  [
    /^set up|^apply dimensions/i,
    'Optional footprint setup: reuse board model associations, attach available project assets, or enter measured dimensions for matching footprints. Unresolved bodies remain unchecked.',
  ],
  [
    /keycap/i,
    'Measured outer keycap envelope, including its skirt. Width and length use millimetres; bottom and top are measured from the top face of the switch plate. No dimensions are assumed. The envelope moves with the switches and is checked against every cover.',
  ],
  [
    /^generate|generating/i,
    'Build solids from this exact draft, board and model revision. Edits and preview controls do not trigger a solid build.',
  ],
  [
    /^(assembled|exploded|section|part|plan)$/i,
    'Plan edits the mounting layout. Assembled joins the parts; exploded separates them; section cuts through the stack; part isolates the selected item. These controls never rebuild solids.',
  ],
  [
    /switch family/i,
    'Choose the actual switch family to infer the switch openings and plate-to-PCB spacing. No family is assumed for a new layout board.',
  ],
  [
    /component model|import models/i,
    'Import STEP, STL or KiCad VRML; associate it with the footprint and confirm units and orientation. Missing models retain a measured or recognised envelope.',
  ],
  [
    /board source|import kicad/i,
    'Choose the current generated PCB or import a KiCad board. A layout reference has no electrical routing. Imported thickness and component placements take precedence.',
  ],
  [
    /advanced|manual/i,
    'Edit individual coordinates and hardware definitions. Manual placements are preserved by automatic redistribution.',
  ],
  [
    /redistribute/i,
    'Replace automatically owned placements using the spacing and clearance rules. Manually edited placements remain fixed.',
  ],
  [
    /include pcb|proposed pcb/i,
    'Include this explicitly proposed hole in the exported board copy. Copper, keepouts and the board edge are checked before the source is changed.',
  ],
  [
    /undo/i,
    'Restore the previous draft edit. Generate again to make its solids current.',
  ],
  [
    /export|download|apply/i,
    'Available after a successful generation of the current draft. Export uses that captured result; Apply inserts one undoable YAML change.',
  ],
  [
    /board profile/i,
    'The named 2D boundary used to size the enclosure. Compare it with the PCB outline before adding hardware.',
  ],
  [
    /existing board outline/i,
    'Use an existing generated outline instead of creating a boundary from layout points.',
  ],
  [
    /mounting system/i,
    'Tray supports the PCB; top and bottom attach the plate to a shell; gasket suspends the plate and attached PCB. Case-closing screws are separate.',
  ],
  [
    /shell split|seam height/i,
    'Height of the joint between shells, measured from the unrotated case datum. It must sit above the floor and below the upper wall.',
  ],
  [
    /alignment joint|mating seam/i,
    'A plain joint has flat mating faces. A stepped joint adds a locating lip and matching clearance recess.',
  ],
  [
    /registration depth/i,
    'Height of the locating lip above the shell split. Leave material above its mating recess.',
  ],
  [
    /registration fit/i,
    'Clearance around the locating lip in millimetres. It compensates for variation between the two manufactured parts.',
  ],
  [
    /compression/i,
    'Fraction of gasket thickness compressed at rest: 0.2 means 20%. This is geometry, not a spring-force simulation.',
  ],
  [
    /travel|movement/i,
    'The plate, PCB and floating components share this displacement. Case shells stay fixed. Preview sliders do not change the configured clearance allowance.',
  ],
  [
    /gasket free/i,
    'Uncompressed pad thickness or sleeve wall thickness in millimetres. Compression determines its assembled thickness.',
  ],
  [
    /pocket.*clearance/i,
    'Gap around a gasket or sleeve, before adding the lateral movement allowance.',
  ],
  [
    /pcb underside/i,
    'Height of the bottom face of the PCB above the unrotated case datum. Component heights are measured from their PCB face.',
  ],
  [
    /plate underside/i,
    'Height of the lower face of the switch plate above the unrotated case datum. Match the switch-to-PCB spacing.',
  ],
  [
    /thickness|minimum wall/i,
    'Material thickness in millimetres. Check the selected process and component requirements; supplier minimums are not recommended case dimensions.',
  ],
  [
    /cutter|corner radius/i,
    'Tool diameter and internal corner radius must allow access at the pocket depth. Rounded cutouts must still fit the actual switch body.',
  ],
  [
    /reach/i,
    'Usable cutting depth, excluding the tool holder. Compare with the deepest pocket in this part.',
  ],
  [
    /stock|build [xyz]/i,
    'Available stock or printer build dimension in millimetres along this axis. The complete part must fit.',
  ],
  [
    /process|manufacturing preset|material/i,
    'Manufacturing method and material for this part. The supplier preset fills starting values; Advanced settings allow measured machine limits.',
  ],
  [
    /drill|hole diameter/i,
    'Finished hole diameter in millimetres. Thread pilot holes and screw clearance holes have different diameters.',
  ],
  [
    /head|pocket diameter|across-flats/i,
    'Space for the screw head, insert or nut. Nut dimensions are across flats. Leave material around the pocket.',
  ],
  [
    /anchor/i,
    'The layout point or named profile used as this feature’s reference. Offsets are relative to that reference.',
  ],
  [
    /offset|bottom \(mm\)|top \(mm\)/i,
    'Position in millimetres relative to the selected anchor or PCB face. Positive Z is above the unrotated board.',
  ],
  [
    /rotation|angle/i,
    'Rotation in degrees. The typing angle tilts the entire stack; local component and mounting rotations follow their anchor.',
  ],
  [
    /bezel/i,
    'Distance from the board envelope to the inner edge of the outside wall. It provides space for gasket pockets and case screws.',
  ],
  [
    /fit allowance|boundary clearance/i,
    'Extra space around the selected outline in millimetres. This changes cavity clearance or the boundary, not PCB geometry.',
  ],
  [
    /height/i,
    'Distance in millimetres from the unrotated case datum. Inspect the section diagram to see its relationship to the stack.',
  ],
  [
    /gap closing/i,
    'Radius used to bridge small gaps between selected key regions. Separate halves require an explicit bridge or separate cases.',
  ],
  [
    /points|selection/i,
    'Choose the layout points included in this region. Helper and mounting points should not create switch cutouts.',
  ],
  [
    /bridge/i,
    'A named connection between two regions. Its ends must overlap those regions, and its width must retain enough material.',
  ],
  [
    /cutout size/i,
    'Nominal switch opening in millimetres. Match the selected switch family and keep its retaining edges intact.',
  ],
  [
    /attachment|mount target/i,
    'Choose which part owns the feature. Floating components move with the plate; fixed components remain attached to the case.',
  ],
  [
    /ledge/i,
    'A continuous rigid support beneath the plate. It cannot be combined with a floating gasket mount.',
  ],
  [
    /supports|orientation|nozzle|layer/i,
    'Printer setting for this part. Check orientation, overhangs and support removal in the slicer.',
  ],
  [
    /insertion|fastener|thread/i,
    'How the screw or insert enters the part. Ensure the head, driver and receiver remain accessible after assembly.',
  ],
  [
    /width|length|size|radius|depth/i,
    'Physical feature dimension in millimetres. Changing it affects fit, adjacent features and remaining wall material.',
  ],
  [
    /construction/i,
    'Top cover hides the gasket pockets. Middle frame adds a separately manufactured frame with a second locating joint.',
  ],
  [
    /case/i,
    'Select the assembly to edit. Separate keyboard halves should use separate cases.',
  ],
];
export function settingHelp(label: string) {
  return (
    HELP.find(([pattern]) => pattern.test(label))?.[1] ||
    `Adjust ${label.toLowerCase()} for the selected case. Review the 2D plan and generated assembly after changing it.`
  );
}
export function CaseHelp({
  label,
  value,
  defaultValue,
}: {
  label: string;
  value?: unknown;
  defaultValue?: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const place = (button: HTMLElement) => {
    const box = button.getBoundingClientRect();
    const { hintWidth, hintMargin, hintGap } = theme.caseWizard;
    const height = 180;
    setPosition({
      left: Math.max(
        hintMargin,
        Math.min(box.left, window.innerWidth - hintWidth - hintMargin * 2)
      ),
      top:
        box.bottom + height > window.innerHeight
          ? Math.max(hintMargin, box.top - height)
          : box.bottom + hintGap,
    });
  };
  const id = useId();
  return (
    <HelpWrap data-open={open}>
      <button
        type="button"
        aria-label={`Help: ${label}`}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={(event) => place(event.currentTarget)}
        onPointerEnter={(event) => place(event.currentTarget)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          place(event.currentTarget);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            event.stopPropagation();
          }
        }}
      >
        ?
      </button>
      <span role="tooltip" id={id} style={position}>
        {settingHelp(label)}
        {defaultValue !== undefined && (
          <span> Default: {String(defaultValue)}.</span>
        )}
        {value !== undefined && <span> Current value: {String(value)}.</span>}
      </span>
    </HelpWrap>
  );
}
const FieldRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${theme.caseWizard.gap};
  margin-bottom: ${theme.caseWizard.gap};
  && label {
    display: block;
    margin: 0;
  }
  > input,
  > select {
    grid-column: 1 / -1;
    min-width: 0;
    width: 100%;
  }
`;
type FieldProps = {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  choices?: string[];
  defaultValue?: unknown;
};
export default function CaseField({
  label,
  value,
  onChange,
  choices,
  defaultValue,
}: FieldProps) {
  const id = useId();
  const custom = value !== null && typeof value === 'object';
  return (
    <FieldRow>
      <label htmlFor={id}>{label}</label>
      <CaseHelp label={label} value={value} defaultValue={defaultValue} />
      {choices ? (
        <select
          id={id}
          aria-label={label}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice || 'Choose…'}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          aria-label={label}
          key={String(value)}
          defaultValue={
            custom ? 'Custom YAML — use advanced editor' : String(value ?? '')
          }
          readOnly={custom}
          onBlur={(event) => {
            const text = event.target.value;
            if (text === String(value ?? '')) {
              return;
            }
            onChange(
              text === 'true'
                ? true
                : text === 'false'
                  ? false
                  : text.trim() !== '' && Number.isFinite(Number(text))
                    ? Number(text)
                    : text
            );
          }}
        />
      )}
    </FieldRow>
  );
}
