import { useState, useRef, PointerEvent } from 'react';
import styled from 'styled-components';
import makerjs, { IModel } from 'makerjs';
import { parseDocument, parse } from 'yaml';
import { useConfigContext } from '../context/ConfigContext';
import { DesignReport, Vec2 } from '../types/design';
import {
  applyDesignEdit,
  editDesign,
  movePoint,
  SourcePath,
} from '../utils/designSource';
import {
  drawnGeometry,
  GeometryRole,
  independentSketch,
} from '../utils/designGeometry';
import AssemblyPreview from './AssemblyPreview';
import SketchDimensions from './SketchDimensions';
import { theme } from '../theme/theme';

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: ${theme.colors.background};
  color: ${theme.colors.text};
  button,
  input,
  select {
    background: ${theme.colors.backgroundLighter};
    color: ${theme.colors.text};
    border: 1px solid ${theme.colors.border};
    padding: ${theme.buttonSizes.small.padding};
  }
`;
const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
`;
const Canvas = styled.svg`
  width: 100%;
  flex: 1;
  min-height: 18rem;
  touch-action: none;
  background: ${theme.colors.backgroundLight};
`;
const Status = styled.p`
  padding: 0.5rem;
  margin: 0;
  color: ${theme.colors.warning};
`;
const pathData = (model: IModel) =>
  makerjs.exporter.toSVGPathData(model, false, [0, 0]) as string;
const DRAW_COUNTS: Record<string, number> = {
  line: 2,
  circle: 2,
  arc: 3,
  bezier: 4,
};
const SNAP_RADIUS = 2;
const ZOOM_STEP = 1.25;

export default function DesignView({
  session,
}: {
  session?: {
    analysis: import('../hooks/useCasePreview').GeometryJob;
    preview: import('../hooks/useCasePreview').GeometryJob;
  };
}) {
  const context = useConfigContext();
  const [selected, setSelected] = useState('');
  const [tool, setTool] = useState('select');
  const [sketchName, setSketchName] = useState('sketch');
  const [construction, setConstruction] = useState(true);
  const [clicks, setClicks] = useState<Vec2[]>([]);
  const [error, setError] = useState('');
  const [grid, setGrid] = useState(1);
  const [constraintType, setConstraintType] = useState('distance');
  const [references, setReferences] = useState('');
  const [dimension, setDimension] = useState('20');
  const [exploded, setExploded] = useState(false);
  const [assembly, setAssembly] = useState('');
  const [part, setPart] = useState('');
  const [dragTarget, setDragTarget] = useState<Vec2 | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const pan = useRef<{
    x: number;
    y: number;
    origin: typeof view;
    scale: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ point: string; before: Vec2; after: Vec2 } | null>(
    null
  );
  if (!context) {
    return null;
  }
  const result = session ? session.analysis.result : context.results;
  const solids = session ? session.preview.result : context.results;
  const stale = session
    ? session.analysis.stale ||
      session.analysis.pending ||
      (!!assembly && session.preview.stale)
    : context.resultsStale;
  const failure = session ? session.analysis.error : context.error;
  const report = result?.designs as DesignReport | undefined;
  const features = report?.features || {};
  const feature = features[selected];
  const sketch = feature?.sketch;
  const source = () => context.getRealtimeConfigInput() || '';
  const commit = (transform: (before: string) => string) => {
    try {
      const before = source();
      const after = transform(before);
      applyDesignEdit(before, after);
      setError('');
      if (!session) {
        void context.generateNow(after, context.injectionInput, {
          pointsonly: false,
        });
      }
    } catch (error) {
      setError(String(error));
    }
  };
  const edit = (path: SourcePath, value: unknown) =>
    commit((before) => editDesign(before, path, value));
  const bounds = Object.values(features).flatMap((feature) =>
    feature.bounds ? [feature.bounds] : []
  );
  const low = [
    bounds.length ? Math.min(...bounds.map((b) => b.low[0])) : -20,
    bounds.length ? Math.min(...bounds.map((b) => b.low[1])) : -20,
  ];
  const high = [
    bounds.length ? Math.max(...bounds.map((b) => b.high[0])) : 20,
    bounds.length ? Math.max(...bounds.map((b) => b.high[1])) : 20,
  ];
  const pad = 10;
  const width = (high[0] - low[0] + pad * 2) / view.zoom;
  const height = (high[1] - low[1] + pad * 2) / view.zoom;
  const zoom = (factor: number) =>
    setView((current) => ({
      ...current,
      zoom: Math.max(0.1, Math.min(20, current.zoom * factor)),
    }));
  const selectRef = (id: string, mode: 'append' | 'replace') =>
    setReferences((current) =>
      mode === 'append' && current ? `${current}, ${id}` : id
    );
  const coordinate = (event: PointerEvent<SVGSVGElement>): Vec2 => {
    const svg = svgRef.current!;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const value = point.matrixTransform(svg.getScreenCTM()!.inverse());
    const raw: Vec2 = [value.x, -value.y];
    const snap = Object.values(sketch?.points || {}).find(
      (p) => Math.hypot(p[0] - raw[0], p[1] - raw[1]) < SNAP_RADIUS
    );
    if (snap && snap !== sketch?.points[drag.current?.point || '']) {
      return [...snap];
    }
    return raw.map((value) =>
      grid > 0 ? Math.round(value / grid) * grid : value
    ) as Vec2;
  };
  const create = (event: PointerEvent<SVGSVGElement>) => {
    if (tool === 'pan') {
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = {
        x: event.clientX,
        y: event.clientY,
        origin: view,
        scale: event.currentTarget.getScreenCTM()!.inverse().a,
      };
      return;
    }
    if (tool === 'select' || stale) {
      return;
    }
    const next = [...clicks, coordinate(event)];
    if (next.length < DRAW_COUNTS[tool]) {
      setClicks(next);
      return;
    }
    commit((before) => {
      const doc = parseDocument(before);
      const base = ['designs', 'sketches', sketchName];
      let serial = 1;
      while (doc.getIn([...base, 'geometry', `${tool}_${serial}`])) {
        serial++;
      }
      const drawing = drawnGeometry(
        tool,
        next,
        `${tool}_${serial}`,
        construction ? GeometryRole.Construction : GeometryRole.Profile
      );
      if (!doc.getIn(base)) {
        return editDesign(before, base, drawing);
      }
      let result = before;
      for (const section of ['points', 'geometry'] as const) {
        for (const [id, value] of Object.entries(drawing[section])) {
          result = editDesign(result, [...base, section, id], value);
        }
      }
      return result;
    });
    setClicks([]);
    setSelected(`sketches.${sketchName}`);
  };
  const addConstraint = () => {
    const refs = references.split(',').map((value) => value.trim());
    const pair = ['coincident', 'distance'].includes(constraintType);
    const lines = [
      'parallel',
      'perpendicular',
      'equal_length',
      'angle',
    ].includes(constraintType);
    const spec: Record<string, unknown> = { type: constraintType };
    if (pair) {
      spec.points = refs;
    } else if (lines) {
      spec.lines = refs;
    } else if (constraintType === 'equal_radius') {
      spec.geometry = refs;
    } else if (constraintType === 'radius') {
      spec.geometry = refs[0];
    } else if (constraintType === 'fixed') {
      spec.point = refs[0];
    } else if (constraintType === 'symmetric') {
      spec.points = refs.slice(0, 2);
      spec.line = refs[2];
    } else if (constraintType === 'tangent') {
      spec.line = refs[0];
      spec.curve = refs[1];
    } else {
      spec.line = refs[0];
    }
    try {
      if (['distance', 'radius', 'angle'].includes(constraintType)) {
        spec.value = parse(dimension);
      }
    } catch (error) {
      setError(String(error));
      return;
    }
    let serial = 1;
    while (feature?.constraints?.[`constraint_${serial}`]) {
      serial++;
    }
    const name = `constraint_${serial}`;
    edit(
      ['designs', 'sketches', selected.split('.')[1], 'constraints', name],
      spec
    );
  };
  const assemblies = solids?.designs?.assemblies || {};
  const assemblyParts = assemblies[assembly]?.parts || {};
  return (
    <Panel aria-label="Design view">
      <Controls>
        <label>
          Feature{' '}
          <select
            aria-label="Design feature"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setPart('');
            }}
          >
            <option value="">All features</option>
            {Object.keys(features).map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          Tool{' '}
          <select
            aria-label="Sketch tool"
            value={tool}
            onChange={(event) => {
              setTool(event.target.value);
              setClicks([]);
            }}
          >
            {['select', 'pan', 'line', 'arc', 'circle', 'bezier'].map(
              (tool) => (
                <option key={tool}>{tool}</option>
              )
            )}
          </select>
        </label>
        <button aria-label="Zoom in" onClick={() => zoom(ZOOM_STEP)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoom(1 / ZOOM_STEP)}>
          −
        </button>
        <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>Fit</button>
        <label>
          Sketch{' '}
          <input
            aria-label="Sketch name"
            value={sketchName}
            onChange={(event) => setSketchName(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={construction}
            onChange={(event) => setConstruction(event.target.checked)}
          />
          Construction
        </label>
        <label>
          Grid mm{' '}
          <input
            aria-label="Snap grid"
            type="number"
            min="0"
            step="0.1"
            value={grid}
            onChange={(event) => setGrid(Number(event.target.value))}
          />
        </label>
        {feature && !sketch && (
          <button
            onClick={() =>
              edit(
                ['designs', 'sketches', sketchName],
                independentSketch(feature.model)
              )
            }
          >
            Convert selected to independent sketch
          </button>
        )}
      </Controls>
      {(stale || failure) && (
        <Status role="status">
          Preview stale — showing the last valid design. {failure}
        </Status>
      )}
      {error && <Status role="alert">{error}</Status>}
      {DRAW_COUNTS[tool] && (
        <Status>
          Click {DRAW_COUNTS[tool]} points ({clicks.length} placed). Arcs use
          center, start, end. Béziers use start, two controls, end.
        </Status>
      )}
      {assembly ? (
        <AssemblyPreview
          parts={assemblyParts}
          cases={{ ...solids?.cases, ...solids?.solids }}
          exploded={exploded}
          selected={part}
          onSelect={setPart}
        />
      ) : (
        <Canvas
          ref={svgRef}
          aria-label="Design canvas"
          viewBox={`${(low[0] + high[0] - width) / 2 + view.x} ${-(low[1] + high[1] + height) / 2 + view.y} ${width} ${height}`}
          onPointerDown={create}
          onPointerMove={(event) => {
            if (pan.current) {
              const start = pan.current;
              setView({
                ...start.origin,
                x: start.origin.x - (event.clientX - start.x) * start.scale,
                y: start.origin.y - (event.clientY - start.y) * start.scale,
              });
              return;
            }
            if (drag.current) {
              drag.current.after = coordinate(event);
              setDragTarget(drag.current.after);
            }
          }}
          onPointerUp={(event) => {
            if (pan.current) {
              pan.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
              return;
            }
            if (!drag.current) {
              return;
            }
            const { point, before, after } = drag.current;
            drag.current = null;
            setDragTarget(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
            commit((source) =>
              movePoint(
                source,
                selected.split('.')[1],
                point,
                before,
                after,
                sketch?.frames?.[point]
              )
            );
          }}
        >
          {Object.entries(features)
            .filter(([id]) => !selected || id === selected)
            .map(([id, feature]) => (
              <path
                key={id}
                d={pathData(feature.model)}
                fill="none"
                stroke={theme.colors.accent}
                strokeWidth="0.4"
                onClick={() => setSelected(id)}
              />
            ))}
          {Object.entries(sketch?.entities || {}).map(([id, entity]) => (
            <g key={id}>
              <path
                d={pathData(entity.model)}
                fill="none"
                stroke={
                  entity.construction
                    ? theme.colors.textDarkest
                    : theme.colors.text
                }
                strokeDasharray={entity.construction ? '2 2' : undefined}
                strokeWidth="0.3"
                onClick={(event) =>
                  selectRef(id, event.shiftKey ? 'append' : 'replace')
                }
              >
                <title>{id}</title>
              </path>
            </g>
          ))}
          {Object.entries(sketch?.points || {}).map(([id, point]) => (
            <g key={id}>
              <circle
                cx={point[0]}
                cy={-point[1]}
                r="0.9"
                fill={theme.colors.accent}
                aria-label={`Drag ${id}`}
                onPointerDown={(event) => {
                  if (stale) {
                    return;
                  }
                  event.stopPropagation();
                  selectRef(id, event.shiftKey ? 'append' : 'replace');
                  svgRef.current!.setPointerCapture(event.pointerId);
                  drag.current = { point: id, before: point, after: point };
                }}
              />
              <text
                x={point[0] + 1}
                y={-point[1] - 1}
                fill={theme.colors.text}
                fontSize="2"
              >
                {id}
              </text>
            </g>
          ))}
          <SketchDimensions sketch={sketch} />
          {Object.entries(assemblyParts)
            .filter(([id]) => !part || id === part)
            .map(([id, part], index) => (
              <g
                key={id}
                transform={`translate(${exploded ? index * 3 : 0},${exploded ? -index * 8 : 0})`}
                onClick={() => setPart(id)}
              >
                {part.slices.map((slice, index) => (
                  <path
                    key={index}
                    d={pathData(slice.model)}
                    fill={theme.colors.accent}
                    fillOpacity="0.12"
                    stroke={theme.colors.text}
                    strokeWidth="0.3"
                  >
                    <title>
                      {id}: z={slice.z} mm, thickness={slice.thickness} mm
                    </title>
                  </path>
                ))}
              </g>
            ))}
          {dragTarget && (
            <circle
              cx={dragTarget[0]}
              cy={-dragTarget[1]}
              r="1.1"
              fill="none"
              stroke={theme.colors.warning}
              strokeWidth="0.4"
            />
          )}
          {clicks.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={-p[1]}
              r="0.7"
              fill={theme.colors.warning}
            />
          ))}
        </Canvas>
      )}
      {feature &&
        selected.split('.').length === 2 &&
        ['regions', 'boundaries', 'profiles'].includes(
          selected.split('.')[0]
        ) && (
          <Controls>
            {['clearance', 'close', 'round'].map((parameter) => (
              <label key={parameter}>
                {parameter} mm{' '}
                <input
                  aria-label={`Design ${parameter}`}
                  defaultValue={String(
                    parseDocument(context.configInput || '').getIn([
                      'designs',
                      ...selected.split('.'),
                      parameter,
                    ]) ?? 0
                  )}
                  key={`${selected}.${parameter}`}
                  onBlur={(event) => {
                    if (event.target.value !== event.target.defaultValue) {
                      edit(
                        ['designs', ...selected.split('.'), parameter],
                        event.target.value
                      );
                    }
                  }}
                />
              </label>
            ))}
          </Controls>
        )}
      {sketch && (
        <>
          <Controls>
            {Object.keys(sketch.dimensions || {}).map((id) => {
              const path = [
                'designs',
                'sketches',
                selected.split('.')[1],
                'constraints',
                id,
                'value',
              ];
              const value = parseDocument(source()).getIn(path);
              const fields =
                typeof value === 'object'
                  ? ['target', 'min', 'max', 'priority']
                  : [''];
              return fields.map((field) => {
                const target = field ? [...path, field] : path;
                return (
                  <label key={`${selected}.${id}.${field}`}>
                    {id} {field}
                    <input
                      aria-label={`Dimension ${id}${field ? ` ${field}` : ''}`}
                      defaultValue={String(
                        parseDocument(source()).getIn(target) ?? ''
                      )}
                      onBlur={(event) => {
                        if (event.target.value !== event.target.defaultValue) {
                          edit(target, event.target.value);
                        }
                      }}
                    />
                  </label>
                );
              });
            })}
          </Controls>
          <Controls>
            <select
              aria-label="Constraint type"
              value={constraintType}
              onChange={(event) => setConstraintType(event.target.value)}
            >
              {[
                'coincident',
                'horizontal',
                'vertical',
                'parallel',
                'perpendicular',
                'tangent',
                'symmetric',
                'equal_length',
                'equal_radius',
                'distance',
                'radius',
                'angle',
                'fixed',
              ].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <input
              aria-label="Constraint references"
              placeholder="Named references, comma separated"
              value={references}
              onChange={(event) => setReferences(event.target.value)}
            />
            <input
              aria-label="Constraint dimension"
              value={dimension}
              onChange={(event) => setDimension(event.target.value)}
            />
            <button onClick={addConstraint}>Add constraint</button>
          </Controls>
          <Controls>
            {Object.entries(sketch.entities).map(([id, entity]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={!!entity.construction}
                  onChange={(event) =>
                    edit(
                      [
                        'designs',
                        'sketches',
                        selected.split('.')[1],
                        'geometry',
                        id,
                        'construction',
                      ],
                      event.target.checked
                    )
                  }
                />
                {id} construction
              </label>
            ))}
          </Controls>
        </>
      )}
      {!!Object.keys(assemblies).length && (
        <Controls>
          <label>
            Assembly{' '}
            <select
              aria-label="Assembly"
              value={assembly}
              onChange={(event) => {
                setAssembly(event.target.value);
                setPart('');
              }}
            >
              <option value="">None</option>
              {Object.keys(assemblies).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label>
            Part{' '}
            <select
              aria-label="Part"
              value={part}
              onChange={(event) => setPart(event.target.value)}
            >
              <option value="">All parts</option>
              {Object.keys(assemblyParts).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={exploded}
              onChange={(event) => setExploded(event.target.checked)}
            />
            Exploded
          </label>
          {(report?.assemblies[assembly]?.suggestions || []).map(
            (suggestion) => (
              <button
                key={suggestion.id}
                onClick={() =>
                  edit(
                    [
                      'designs',
                      'assemblies',
                      assembly,
                      suggestion.kind === 'gasket' ? 'gaskets' : 'mounts',
                      suggestion.id,
                    ],
                    suggestion.definition
                  )
                }
              >
                Accept {suggestion.id}
              </button>
            )
          )}
        </Controls>
      )}
      {report?.adjustments.map((adjustment) => (
        <Status key={adjustment.feature}>
          {adjustment.feature}: {adjustment.target} →{' '}
          {adjustment.actual.toFixed(3)} (allowed {adjustment.min}–
          {adjustment.max})
        </Status>
      ))}
    </Panel>
  );
}
