import { useMemo, useRef, useState } from 'react';
import makerjs, { IModel } from 'makerjs';
import styled from 'styled-components';
import {
  CaseConfig,
  CaseAnalysis,
  CaseEdge,
  CasePlacement,
} from '../types/case';
import Field, { CaseHelp } from './CaseField';
import { theme } from '../theme/theme';
const PADDING = 8,
  KEY_STEP = 0.5;
const Frame = styled.div`
  position: relative;
  flex-shrink: 0;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.caseWizard.radius};
  margin-bottom: ${theme.caseWizard.gap};
  svg {
    width: 100%;
    max-height: ${theme.caseWizard.planHeight};
    min-height: ${theme.caseWizard.diagramHeight};
    touch-action: none;
  }
  svg:focus {
    outline: 2px solid ${theme.colors.accent};
  }
  button,
  input {
    font: inherit;
  }
`;
const Popover = styled.div`
  position: absolute;
  right: ${theme.caseWizard.gap};
  top: ${theme.caseWizard.gap};
  z-index: 1;
  background: ${theme.colors.backgroundLighter};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.caseWizard.radius};
  padding: ${theme.caseWizard.gap};
  width: ${theme.caseWizard.popoverWidth};
  max-height: 85%;
  overflow: auto;
`;
function lines(model: IModel) {
  const result: number[][][] = [];
  makerjs.model.walk(model, {
    onPath: ({ pathContext, offset }) => {
      const path = makerjs.path.moveRelative(
        makerjs.path.clone(pathContext),
        offset
      );
      const count =
        path.type === 'line'
          ? 1
          : Math.max(12, Math.ceil(makerjs.measure.pathLength(path) / 2));
      result.push(
        Array.from({ length: count + 1 }, (_, i) => [
          makerjs.point.middle(path, i / count)[0],
          makerjs.point.middle(path, i / count)[1],
        ])
      );
    },
  });
  return result;
}
function Drawing({ model, color }: { model?: IModel; color: string }) {
  const segments = useMemo(() => (model ? lines(model) : []), [model]);
  return (
    <g fill="none" stroke={color} strokeWidth={0.35}>
      {segments.map((points, i) => (
        <polyline key={i} points={points.map((p) => p.join(',')).join(' ')} />
      ))}
    </g>
  );
}
export function ProfilePreview({
  model,
  label,
}: {
  model?: IModel;
  label: string;
}) {
  const bounds = model ? makerjs.measure.modelExtents(model) : null;
  return (
    <Frame>
      <strong>{label}</strong>
      {bounds ? (
        <svg
          aria-label={`${label} 2D preview`}
          viewBox={`${bounds.low[0] - PADDING} ${-bounds.high[1] - PADDING} ${bounds.width + 2 * PADDING} ${bounds.height + 2 * PADDING}`}
        >
          <g transform="scale(1,-1)">
            <Drawing model={model} color={theme.colors.accent} />
          </g>
        </svg>
      ) : (
        <p>No resolved outline yet.</p>
      )}
    </Frame>
  );
}
function nearest(point: number[], edges: CaseEdge[]) {
  let best = { position: point, angle: 0, edge: '', distance: Infinity };
  for (const edge of edges) {
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1],
        b = edge.points[i],
        d = [b[0] - a[0], b[1] - a[1]],
        n = d[0] * d[0] + d[1] * d[1];
      const t = n
        ? Math.max(
            0,
            Math.min(
              1,
              ((point[0] - a[0]) * d[0] + (point[1] - a[1]) * d[1]) / n
            )
          )
        : 0;
      const position = [a[0] + t * d[0], a[1] + t * d[1]],
        distance = Math.hypot(point[0] - position[0], point[1] - position[1]);
      if (distance < best.distance) {
        best = {
          position,
          angle: (Math.atan2(d[1], d[0]) * 180) / Math.PI,
          edge: edge.id,
          distance,
        };
      }
    }
  }
  return best;
}
type Props = {
  analysis?: CaseAnalysis;
  pcb?: IModel;
  cutouts?: IModel[];
  selected: string;
  onSelect: (id: string) => void;
  onEdit: (item: CasePlacement, definition: CaseConfig) => void;
  onAdd: (
    kind: 'mount' | 'gasket',
    position: number[],
    edge: string,
    angle: number
  ) => void;
  onRemove: (item: CasePlacement) => void;
  onDuplicate: (item: CasePlacement) => void;
};
export default function CasePlanPreview({
  analysis,
  pcb,
  cutouts = [],
  selected,
  onSelect,
  onEdit,
  onAdd,
  onRemove,
  onDuplicate,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<'select' | 'mount' | 'gasket'>('select');
  const [drag, setDrag] = useState<{
    item: CasePlacement;
    position: number[];
    edge: string;
    angle: number;
  } | null>(null);
  const box = analysis?.exterior
    ? makerjs.measure.modelExtents(analysis.exterior)
    : analysis?.bounds;
  const chosen = analysis?.placements.find(
    (p) => `${p.kind === 'gasket' ? 'gaskets' : 'mounts'}.${p.id}` === selected
  );
  const point = (event: { clientX: number; clientY: number }) => {
    const screen = svg.current?.getScreenCTM();
    if (!screen) {
      return [0, 0];
    }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      screen.inverse()
    );
    return [p.x, -p.y];
  };
  const move = (
    item: CasePlacement,
    p: number[],
    mode: 'drag' | 'offset' = 'drag'
  ) => {
    const edges = analysis?.edges || [];
    const attached = edges.filter(
      (edge) => edge.id === item.definition.placement?.edge
    );
    const hit = nearest(
      p,
      mode === 'offset' && attached.length ? attached : edges
    );
    const angle = (hit.angle * Math.PI) / 180;
    let normal = [Math.sin(angle), -Math.cos(angle)];
    if (
      analysis?.model &&
      makerjs.measure.isPointInsideModel(
        hit.position.map((v, i) => v + normal[i]),
        analysis.model
      )
    ) {
      normal = normal.map((v) => -v);
    }
    const original = nearest(item.position, edges);
    const offset = Number(
      item.definition.placement?.offset ??
        item.position.reduce(
          (sum, v, i) => sum + (v - original.position[i]) * normal[i],
          0
        )
    );
    // Keep the normal clearance fixed while a feature moves along its edge.
    return {
      item,
      position: hit.position.map((v, i) => v + normal[i] * offset),
      edge: hit.edge,
      angle:
        item.kind === 'gasket'
          ? hit.angle
          : Number(item.definition.anchor?.rotate || 0),
    };
  };
  const commit = (next: NonNullable<typeof drag>) =>
    onEdit(next.item, {
      ...next.item.definition,
      anchor: { shift: next.position, rotate: next.angle },
      placement: {
        ...next.item.definition.placement,
        owner: 'manual',
        edge: next.edge,
      },
    });
  if (!box) {
    return <p>Resolve a board outline to edit mounting locations.</p>;
  }
  return (
    <Frame>
      <div>
        <strong>Mounting plan</strong>
        <CaseHelp label="Mounting system" />
        {(['select', 'gasket', 'mount'] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tool === t}
            title={
              t === 'select'
                ? 'Select and drag a feature.'
                : 'Click an edge to add a ' + t
            }
            onClick={() => setTool(t)}
          >
            {t === 'select' ? 'Select' : `Add ${t}`}
          </button>
        ))}
      </div>
      <p>
        Outline · PCB · switch openings · mounting features —{' '}
        {box.width.toFixed(1)} × {box.height.toFixed(1)} mm
      </p>
      <svg
        ref={svg}
        data-placements={analysis?.placements.length}
        data-candidates={analysis?.suggestions.length}
        aria-label="Interactive mounting plan"
        viewBox={`${box.low[0] - PADDING} ${-box.high[1] - PADDING} ${box.width + PADDING * 2} ${box.height + PADDING * 2}`}
        onPointerMove={(event) => {
          if (drag) {
            setDrag(move(drag.item, point(event)));
          }
        }}
        onPointerUp={() => {
          if (drag) {
            if (
              drag.position.some(
                (v, i) => Math.abs(v - drag.item.position[i]) > 0.001
              ) ||
              Math.abs(
                drag.angle - Number(drag.item.definition.anchor?.rotate || 0)
              ) > 0.001
            ) {
              commit(drag);
            }
            setDrag(null);
          }
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <g transform="scale(1,-1)">
          <Drawing model={analysis?.exterior} color={theme.colors.textDarker} />
          <Drawing model={analysis?.model} color={theme.colors.text} />
          <Drawing model={pcb} color={theme.colors.infoDark} />
          {cutouts.map((model, i) => (
            <Drawing key={i} model={model} color={theme.colors.warning} />
          ))}
          {analysis?.edges.map((edge) => (
            <polyline
              key={edge.id}
              points={edge.points.map((p) => p.join(',')).join(' ')}
              stroke="transparent"
              strokeWidth={3}
              fill="none"
              onClick={(event) => {
                if (tool === 'select') {
                  return;
                }
                const hit = nearest(point(event), [edge]);
                onAdd(tool, hit.position, edge.id, hit.angle);
                setTool('select');
              }}
            />
          ))}
          {analysis?.holeProposals?.map((hole) => (
            <g key={hole.id}>
              <circle
                cx={hole.position[0]}
                cy={hole.position[1]}
                r={hole.diameter / 2}
                fill="none"
                stroke={theme.colors.warning}
                strokeDasharray="1 1"
              />
              <title>
                Proposed PCB hole {hole.id}: {hole.diameter} mm. Include it in
                Hardware to change the board.
              </title>
            </g>
          ))}
          {analysis?.placements.map((item) => {
            const active = drag?.item.id === item.id ? drag : null;
            const p = active?.position || item.position;
            return (
              <g
                key={`${item.kind}.${item.id}`}
                transform={`translate(${p[0]} ${p[1]}) rotate(${active?.angle ?? Number(item.definition.anchor?.rotate || 0)})`}
                stroke={
                  analysis?.findings.some((f) =>
                    f.feature.endsWith(`.${item.id}`)
                  )
                    ? theme.colors.error
                    : selected.endsWith(`.${item.id}`)
                      ? theme.colors.accent
                      : 'none'
                }
                strokeWidth={0.6}
                data-owner={item.definition.placement?.owner}
                tabIndex={0}
                role="button"
                aria-label={`${item.kind} ${item.id}`}
                onClick={() =>
                  onSelect(
                    `${item.kind === 'gasket' ? 'gaskets' : 'mounts'}.${item.id}`
                  )
                }
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(
                    `${item.kind === 'gasket' ? 'gaskets' : 'mounts'}.${item.id}`
                  );
                  svg.current?.setPointerCapture(event.pointerId);
                  setDrag({
                    item,
                    position: item.position,
                    edge: item.definition.placement?.edge || '',
                    angle: Number(item.definition.anchor?.rotate || 0),
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Delete') {
                    onRemove(item);
                    event.preventDefault();
                    return;
                  }
                  const axis =
                    event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                      ? 0
                      : 1;
                  const delta =
                    event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                      ? -KEY_STEP
                      : KEY_STEP;
                  if (event.key.startsWith('Arrow')) {
                    const next = [...item.position];
                    next[axis] += delta;
                    commit(move(item, next));
                    event.preventDefault();
                  }
                  if (event.key === 'Enter') {
                    onSelect(
                      `${item.kind === 'gasket' ? 'gaskets' : 'mounts'}.${item.id}`
                    );
                  }
                }}
              >
                <title>
                  {item.kind} {item.id}: drag to move; Delete removes
                </title>
                {item.kind === 'gasket' ? (
                  <rect
                    x={-Number(item.definition.size?.[0] || 10) / 2}
                    y={-Number(item.definition.size?.[1] || 6) / 2}
                    width={Number(item.definition.size?.[0] || 10)}
                    height={Number(item.definition.size?.[1] || 6)}
                    fill={theme.colors.accent}
                    opacity={0.7}
                  />
                ) : (
                  <>
                    <circle
                      r={Number(item.definition.post || 3)}
                      fill={theme.colors.infoDark}
                    />
                    <circle
                      r={Number(item.definition.hole || 1.1)}
                      fill={theme.colors.background}
                    />
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {chosen && (
        <Popover
          role="dialog"
          aria-label={`Edit ${chosen.id}`}
          style={{
            right: 'auto',
            left: `clamp(0px, ${((chosen.position[0] - box.low[0]) / box.width) * 100}%, calc(100% - 260px))`,
          }}
        >
          <strong>{chosen.id}</strong>
          <button
            aria-label="Close feature editor"
            onClick={() => onSelect('')}
          >
            ×
          </button>
          <Field
            label="Edge offset (mm)"
            value={chosen.definition.placement?.offset || 0}
            onChange={(value) => {
              const definition = {
                ...chosen.definition,
                placement: {
                  ...chosen.definition.placement,
                  offset: Number(value),
                },
              };
              const next = move(
                { ...chosen, definition },
                chosen.position,
                'offset'
              );
              onEdit(chosen, {
                ...definition,
                anchor: { shift: next.position, rotate: next.angle },
              });
            }}
          />
          {chosen.kind === 'mount' && (
            <Field
              label="Fastener receiver"
              value={chosen.definition.hardware || 'plain'}
              choices={['plain', 'tapped', 'insert', 'nut']}
              onChange={(value) =>
                onEdit(chosen, { ...chosen.definition, hardware: value })
              }
            />
          )}
          {chosen.kind === 'gasket' ? (
            <>
              {[0, 1].map((axis) => (
                <Field
                  key={axis}
                  label={axis ? 'Contact width (mm)' : 'Contact length (mm)'}
                  value={chosen.definition.size?.[axis]}
                  onChange={(value) => {
                    const size = [...(chosen.definition.size || [10, 6])];
                    size[axis] = value;
                    onEdit(chosen, { ...chosen.definition, size });
                  }}
                />
              ))}
            </>
          ) : (
            <Field
              label="Hole diameter (mm)"
              value={Number(chosen.definition.hole) * 2}
              onChange={(value) =>
                onEdit(chosen, {
                  ...chosen.definition,
                  hole: Number(value) / 2,
                })
              }
            />
          )}
          <Field
            label="Contact rotation (degrees)"
            value={chosen.definition.anchor?.rotate || 0}
            onChange={(value) =>
              onEdit(chosen, {
                ...chosen.definition,
                anchor: { ...chosen.definition.anchor, rotate: value },
              })
            }
          />
          <button onClick={() => onDuplicate(chosen)}>Duplicate</button>
          <button onClick={() => onRemove(chosen)}>Delete</button>
        </Popover>
      )}
    </Frame>
  );
}
export function StackDiagram({ spec }: { spec: CaseConfig }) {
  const height = Number(spec.height || 24);
  const scale = 90 / height;
  const z = (value: unknown) => 108 - Number(value) * scale;
  const split = Number(spec.seam?.z ?? spec.plate_z ?? 13);
  const levels = [
    {
      name: 'Floor',
      height: Number(spec.floor || 2),
      thickness: Number(spec.floor || 2),
    },
    {
      name: 'PCB',
      height: Number(spec.pcb_z || 6),
      thickness: Number(spec.pcb_thickness || 1.6),
    },
    {
      name: 'Plate',
      height: Number(spec.plate_z || 13),
      thickness: Number(spec.plate || 1.5),
    },
    { name: 'Shell split', height: split, thickness: 0 },
  ].sort((a, b) => b.height - a.height);
  return (
    <Frame>
      <strong>Stack section · underside of case = 0 mm</strong>
      <svg aria-label="Case stack section" viewBox="0 0 250 135">
        <path
          d={`M 10 ${z(height)} V 108 H 100 V ${z(height)}`}
          fill="none"
          stroke={theme.colors.text}
          strokeWidth="3"
        />
        {levels.map((level, index) => {
          const labelY = 28 + index * 22;
          const lineY = z(level.height);
          return (
            <g key={level.name}>
              {level.thickness > 0 && (
                <rect
                  x="12"
                  width="86"
                  y={z(
                    level.name === 'Floor'
                      ? level.height
                      : level.height + level.thickness
                  )}
                  height={level.thickness * scale}
                  fill={
                    level.name === 'PCB'
                      ? theme.colors.infoDark
                      : theme.colors.accent
                  }
                  opacity="0.6"
                />
              )}
              <path
                d={`M 12 ${lineY} H 103 L 119 ${labelY} H 125`}
                fill="none"
                stroke={theme.colors.text}
                strokeDasharray={
                  level.name === 'Shell split' ? '2 2' : undefined
                }
              />
              <text
                x="129"
                y={labelY + 2}
                fontSize="8"
                fill={theme.colors.text}
              >
                {level.name} {level.height.toFixed(1)} mm
              </text>
            </g>
          );
        })}
        {spec.seam?.type === 'stepped' && (
          <>
            <path
              d={`M 10 ${z(split)} H 16 V ${z(split + Number(spec.seam.depth || 1))} H 20`}
              fill="none"
              stroke={theme.colors.warning}
              strokeWidth="2"
            />
            <text x="10" y="126" fontSize="8" fill={theme.colors.text}>
              Registration lip: {spec.seam.depth ?? 1} mm · fit:{' '}
              {spec.seam.fit ?? 0.3} mm
            </text>
          </>
        )}
      </svg>
    </Frame>
  );
}
