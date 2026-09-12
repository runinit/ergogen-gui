import { setStackDimension } from '../utils/stackDimensions';
import { useState } from 'react';
import { Layers, Trash2 } from 'lucide-react';
import {
  getValue,
  setValue,
  removeValue,
  nextId,
  readStudio,
} from '../utils/studioSource';
import {
  pitchUnits,
  formatDimension,
  type Dimension,
} from '../utils/designUnits';
import type { SheetLayer, StackupSpec } from '../types/stackup';
import { useLayoutAnalysis } from '../hooks/useCasePreview';
import DimensionField from './DimensionField';
import { StudioActions, StudioField } from './StudioStyles';
import { theme } from '../theme/theme';
const MATERIAL_COLORS = {
  foam: theme.studio.component,
  silicone: theme.colors.accent,
  gasket: theme.studio.key,
};
const FIT_LABELS = {
  ready: 'Fits gap',
  interference: 'Interference',
  unresolved: 'Unresolved',
};

export default function StackupPanel({
  source,
  onChange,
}: {
  source: string;
  onChange: (source: string) => void;
}) {
  const data = readStudio(source),
    boards = Object.keys(data.pcbs || {});
  const [board, setBoard] = useState(boards[0] || 'main');
  const [selected, setSelected] = useState('');
  const stacks = (getValue(source, ['designs', 'stackups']) || {}) as Record<
    string,
    StackupSpec
  >;
  const name =
    Object.keys(stacks).find((id) => stacks[id].pcb === board) || board;
  const spec = stacks[name] || {
    pcb: board,
    plate: { thickness: 1.5, gap: 5.4 },
    layers: {},
  };
  const preview = useLayoutAnalysis(source, undefined, true);
  const report = preview.result?.stackups?.[name];
  const units = pitchUnits(source);
  const patch = (path: (string | number)[], value: unknown) => {
    let next = source;
    if (!stacks[name]) {
      next = setValue(next, ['designs', 'stackups', name], spec);
    }
    onChange(
      path[0] === 'plate'
        ? setStackDimension(next, ['designs', 'stackups', name, ...path], value)
        : setValue(next, ['designs', 'stackups', name, ...path], value)
    );
  };
  const field = (
    label: string,
    path: string[],
    fallback: Dimension,
    suffix = 'mm'
  ) => (
    <DimensionField
      label={label}
      suffix={suffix}
      value={
        (getValue(source, ['designs', 'stackups', name, ...path]) ??
          fallback) as Dimension
      }
      units={units}
      onCommit={(value) => patch(path, value)}
    />
  );
  const add = (kind: 'plate' | 'case' | 'gasket') => {
    const id = nextId(
      Object.keys(spec.layers || {}),
      kind === 'plate' ? 'plate_foam' : kind === 'case' ? 'case_foam' : 'gasket'
    );
    const layer: SheetLayer = {
      label:
        kind === 'plate'
          ? 'Plate foam'
          : kind === 'case'
            ? 'Case foam'
            : 'Gasket pads',
      material: kind === 'gasket' ? 'gasket' : 'foam',
      lower: kind === 'case' ? 'case.floor' : 'pcb.top',
      upper: kind === 'case' ? 'pcb.bottom' : 'plate.bottom',
      thickness: kind === 'plate' ? 3 : 2,
      compression: 0,
      clearance: 0,
      inset: 0,
    };
    patch(['layers', id], layer);
    setSelected(id);
  };
  const surfaces = report?.surfaces || {
    'pcb.bottom': 0,
    'pcb.top': 1.6,
    'plate.bottom': 7,
    'plate.top': 8.5,
  };
  const low = Math.min(-2, ...Object.values(surfaces)),
    high = Math.max(15, ...Object.values(surfaces));
  const y = (value: number) => 110 - ((value - low) / (high - low)) * 90;
  const layer = spec.layers?.[selected];
  return (
    <section aria-label="Mechanical stack">
      <StudioField>
        <span>Board</span>
        <select
          aria-label="Stack board"
          value={board}
          onChange={(event) => {
            setBoard(event.target.value);
            setSelected('');
          }}
        >
          {boards.map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
      </StudioField>
      <svg
        viewBox="0 0 220 125"
        role="img"
        aria-label="Mechanical stack section"
        style={{ width: '100%', background: theme.colors.background }}
      >
        {(['pcb', 'plate'] as const).map((kind) => {
          const bottom = surfaces[`${kind}.bottom`],
            top = surfaces[`${kind}.top`];
          return (
            <g key={kind}>
              <rect
                x="12"
                width="100"
                y={y(top)}
                height={Math.max(1, y(bottom) - y(top))}
                fill={theme.studio.selected}
                stroke={theme.studio.key}
                strokeWidth=".5"
              />
              <text
                x="120"
                y={y((top + bottom) / 2) + 3}
                fill={theme.colors.text}
                fontSize="9"
              >
                {kind === 'pcb' ? 'PCB' : 'Plate'} ·{' '}
                {formatDimension(top - bottom)} mm
              </text>
            </g>
          );
        })}
        {surfaces['case.floor'] !== undefined && (
          <g>
            <line
              x1="12"
              x2="112"
              y1={y(surfaces['case.floor'])}
              y2={y(surfaces['case.floor'])}
              stroke={theme.studio.key}
            />
            <text
              x="120"
              y={y(surfaces['case.floor']) + 3}
              fontSize="9"
              fill={theme.colors.text}
            >
              Case floor
            </text>
          </g>
        )}
        {Object.entries(report?.layers || {})
          .filter(
            ([, entry]) =>
              entry.z !== undefined && entry.installed !== undefined
          )
          .map(([id, entry]) => (
            <rect
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${entry.label || id}`}
              x="20"
              width="80"
              y={y(entry.z! + entry.installed!)}
              height={Math.max(1, y(entry.z!) - y(entry.z! + entry.installed!))}
              fill={
                entry.status === 'interference'
                  ? theme.colors.error
                  : MATERIAL_COLORS[entry.material]
              }
              fillOpacity={id === selected ? 0.8 : 0.35}
              onClick={() => setSelected(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSelected(id);
                }
              }}
            />
          ))}
      </svg>
      {preview.error && <p role="alert">{preview.error}</p>}
      <small>Section in millimetres, measured from the PCB underside.</small>
      <StudioActions aria-label="Material section legend">
        {Object.entries(spec.layers || {}).map(([id, item]) => {
          const entry = report?.layers[id];
          return (
            <button
              key={id}
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
            >
              <span
                aria-hidden="true"
                style={{ color: MATERIAL_COLORS[item.material] }}
              >
                ■
              </span>
              {item.label || id} · {item.material}
              {entry?.installed !== undefined
                ? ` · ${formatDimension(entry.installed)} mm`
                : ''}{' '}
              · {entry ? FIT_LABELS[entry.status] : 'Previewing'}
            </button>
          );
        })}
      </StudioActions>
      <DimensionField
        label="PCB thickness"
        value={data.pcbs?.[board]?.thickness ?? 1.6}
        units={units}
        onCommit={(value) =>
          onChange(
            setStackDimension(source, ['pcbs', board, 'thickness'], value)
          )
        }
      />
      {field('Plate thickness', ['plate', 'thickness'], 1.5)}
      {field('PCB to plate gap', ['plate', 'gap'], 5.4)}
      <h3>Material layers</h3>
      <StudioActions>
        <button onClick={() => add('plate')}>
          <Layers size={15} />
          Plate foam
        </button>
        <button onClick={() => add('case')}>Case foam</button>
        <button onClick={() => add('gasket')}>Gasket pads</button>
      </StudioActions>
      <p>
        Gap fit uses these dimensions. Apply setup saves them; cutting outlines
        are checked in Export.
      </p>
      {layer && (
        <>
          <h3>{layer.label || selected}</h3>
          <StudioField>
            <span>Material</span>
            <select
              aria-label="Layer material"
              value={layer.material}
              onChange={(event) =>
                patch(['layers', selected, 'material'], event.target.value)
              }
            >
              {['foam', 'silicone', 'gasket'].map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </StudioField>
          {(['lower', 'upper'] as const).map((face) => (
            <StudioField key={face}>
              <span>{face === 'lower' ? 'Above' : 'Below'}</span>
              <select
                aria-label={`Layer ${face} surface`}
                value={layer[face]}
                onChange={(event) =>
                  patch(['layers', selected, face], event.target.value)
                }
              >
                {Array.from(
                  new Set([...Object.keys(surfaces), 'case.floor', layer[face]])
                ).map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </StudioField>
          ))}
          {field(
            'Stock thickness',
            ['layers', selected, 'thickness'],
            layer.thickness
          )}
          {field(
            'Compression ratio',
            ['layers', selected, 'compression'],
            0,
            ''
          )}
          {field('Outline inset', ['layers', selected, 'inset'], 0)}
          {field('Cutout clearance', ['layers', selected, 'clearance'], 0)}
          <StudioField>
            <span>Cutting profile</span>
            <select
              aria-label="Layer cutting profile"
              value={layer.profile || ''}
              onChange={(event) =>
                event.target.value
                  ? patch(['layers', selected, 'profile'], event.target.value)
                  : onChange(
                      removeValue(source, [
                        'designs',
                        'stackups',
                        name,
                        'layers',
                        selected,
                        'profile',
                      ])
                    )
              }
            >
              <option value="">
                {layer.material === 'gasket'
                  ? 'Gasket contacts'
                  : 'PCB outline'}
              </option>
              {Object.keys(data.designs?.profiles || {}).map((id) => (
                <option key={id} value={`profiles.${id}`}>
                  {id}
                </option>
              ))}
            </select>
          </StudioField>
          <details>
            <summary>Additional cutouts</summary>
            {Object.keys(data.designs?.profiles || {}).map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={layer.cutouts?.includes(`profiles.${id}`) || false}
                  onChange={(event) =>
                    patch(
                      ['layers', selected, 'cutouts'],
                      event.target.checked
                        ? [...(layer.cutouts || []), `profiles.${id}`]
                        : (layer.cutouts || []).filter(
                            (ref) => ref !== `profiles.${id}`
                          )
                    )
                  }
                />
                {id}
              </label>
            ))}
          </details>
          <p role="status">
            {report?.layers[selected]?.message ||
              (report?.layers[selected]?.remaining !== undefined
                ? `${formatDimension(report.layers[selected].remaining!)} mm ${report.layers[selected].remaining! < 0 ? 'interference' : 'remaining space'}`
                : 'Resolving surfaces…')}
          </p>
          <small>
            Stock thickness and compression are entered values. Adding material
            keeps the stack in place.
          </small>
          <button
            onClick={() => {
              onChange(
                removeValue(source, [
                  'designs',
                  'stackups',
                  name,
                  'layers',
                  selected,
                ])
              );
              setSelected('');
            }}
          >
            <Trash2 size={15} />
            Remove layer
          </button>
        </>
      )}
    </section>
  );
}
