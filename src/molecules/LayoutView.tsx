import { useEffect, useRef, useState } from 'react';
import { parseDocument } from 'yaml';
import styled from 'styled-components';
import type { ResolvedObject } from 'ergogen/src/native';
import { useConfigContext } from '../context/ConfigContext';
import { useLayoutAnalysis } from '../hooks/useCasePreview';
import { applyDesignEdit } from '../utils/designSource';
import { moveLayout, setLayout, LayoutSection } from '../utils/layoutSource';
import { theme } from '../theme/theme';

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  overflow: auto;
  min-height: 0;
  flex: 1;
  color: ${theme.colors.text};
  background: ${theme.colors.background};
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.sm};
    border: 1px solid ${theme.colors.border};
  }
  label {
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
  }
  input,
  select,
  button {
    max-width: 12rem;
    color: ${theme.colors.text};
    background: ${theme.colors.backgroundLight};
    border: 1px solid ${theme.colors.border};
    padding: ${theme.spacing.sm};
  }
  input[type='number'] {
    width: 6rem;
  }
  p {
    padding: ${theme.spacing.sm};
    margin: 0;
  }
  svg {
    width: 100%;
    flex: 1;
    min-height: 18rem;
    touch-action: none;
    background: ${theme.colors.backgroundLight};
  }
`;
const PADDING = 12;
const MIN_EXTENT = 30;
const AXES = ['X', 'Y', 'Z'];

function polygon(item: ResolvedObject, side: string) {
  const envelope =
    (side === 'top' && item.kind === 'key' && item.envelopes.keycap) ||
    item.envelopes.body ||
    item.envelopes.pcb;
  if (!envelope) {
    return '';
  }
  if (side === 'side') {
    const bounds = item.bounds.body || item.bounds.pcb;
    return [
      [bounds[0][0], bounds[0][2]],
      [bounds[1][0], bounds[0][2]],
      [bounds[1][0], bounds[1][2]],
      [bounds[0][0], bounds[1][2]],
    ]
      .map(([x, z]) => `${x},${-z}`)
      .join(' ');
  }
  const size = envelope.size || [
    (envelope.radius || 1) * 2,
    (envelope.radius || 1) * 2,
  ];
  const points =
    envelope.polygon ||
    (envelope.radius
      ? Array.from({ length: 32 }, (_, i) => [
          Math.cos((i * Math.PI) / 16) * envelope.radius!,
          Math.sin((i * Math.PI) / 16) * envelope.radius!,
        ])
      : [
          [-size[0] / 2, -size[1] / 2],
          [size[0] / 2, -size[1] / 2],
          [size[0] / 2, size[1] / 2],
          [-size[0] / 2, size[1] / 2],
        ]);
  const angle = ((envelope.rotate || 0) * Math.PI) / 180;
  const matrix = item.matrix;
  return points
    .map(([x, y]) => {
      const local = [
        x * Math.cos(angle) - y * Math.sin(angle) + (envelope.at?.[0] || 0),
        x * Math.sin(angle) + y * Math.cos(angle) + (envelope.at?.[1] || 0),
        envelope.at?.[2] || 0,
      ];
      const world = [0, 1].map(
        (row) =>
          matrix[row * 4 + 3] +
          local.reduce((sum, v, i) => sum + matrix[row * 4 + i] * v, 0)
      );
      return `${world[0]},${-world[1]}`;
    })
    .join(' ');
}

export default function LayoutView() {
  const context = useConfigContext();
  const setCadActive = context?.setCadActive;
  useEffect(() => {
    setCadActive?.(true);
    return () => setCadActive?.(false);
  }, [setCadActive]);
  const source = context?.getRealtimeConfigInput() || '';
  const analysis = useLayoutAnalysis(source, context?.injectionInput);
  const [selected, setSelected] = useState('');
  const [section, setSection] = useState<LayoutSection>('objects');
  const [view, setView] = useState('top');
  const [layer, setLayer] = useState('');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState<{
    id: string;
    start: number[];
    delta: number[];
    source: string;
  } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const report = analysis.result?.layout;
  const collection = report?.[section] || {};
  const chosen = collection[selected];
  const chosenPath = (
    'sourcePath' in (chosen || {})
      ? (chosen as ResolvedObject).sourcePath
      : `layout.clusters.${selected}`
  ).split('.');
  const yaw =
    parseDocument(source).getIn([
      ...chosenPath,
      'placement',
      'override',
      'rotate',
    ]) ?? 0;
  const document = parseDocument(source);
  const authoredLock = document.getIn([...chosenPath, 'locked']);
  const inheritedLock =
    section === 'objects' &&
    !!document.getIn([
      'layout',
      'clusters',
      (chosen as ResolvedObject | undefined)?.cluster || '',
      'locked',
    ]);
  const locked = inheritedLock || Boolean(authoredLock ?? chosen?.locked);
  const items = Object.values(report?.objects || {}).filter(
    (item) => !layer || item.layer === layer
  );
  const axis = view === 'side' ? 2 : 1;
  const positions = items.flatMap((item) => Object.values(item.bounds).flat());
  const low = [0, axis].map(
    (i) => Math.min(0, ...positions.map((p) => p[i])) - PADDING
  );
  const high = [0, axis].map(
    (i) => Math.max(MIN_EXTENT, ...positions.map((p) => p[i])) + PADDING
  );
  const blocked = analysis.stale || analysis.pending || !!analysis.error;
  const commit = (change: (before: string) => string) => {
    try {
      const before = context?.getRealtimeConfigInput() || '';
      applyDesignEdit(before, change(before));
      setError('');
    } catch (caught) {
      setError(String(caught));
    }
  };
  const move = (delta: number[]) => {
    if (!chosen || locked || blocked) {
      return;
    }
    commit((before) =>
      moveLayout(before, section, selected, delta, chosen.editMatrix)
    );
  };
  const point = (event: { clientX: number; clientY: number }) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) {
      return [0, 0, 0];
    }
    const value = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );
    return view === 'side' ? [value.x, 0, -value.y] : [value.x, -value.y, 0];
  };
  return (
    <Panel aria-label="Layout editor">
      <fieldset>
        <legend>Layout</legend>
        <label>
          Selection
          <select
            aria-label="Selection type"
            value={section}
            onChange={(e) => {
              setSection(e.target.value as LayoutSection);
              setSelected('');
            }}
          >
            <option value="objects">Objects</option>
            <option value="clusters">Clusters</option>
          </select>
        </label>
        <label>
          Object
          <select
            aria-label="Layout object"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose…</option>
            {Object.entries(collection).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          View
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="top">Top · XY</option>
            <option value="side">Side · XZ</option>
          </select>
        </label>
        <label>
          Visible layer
          <select value={layer} onChange={(e) => setLayer(e.target.value)}>
            <option value="">All layers</option>
            {Object.keys(report?.layers || {}).map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
      </fieldset>
      {chosen && (
        <fieldset disabled={blocked}>
          <legend>
            {chosen.label} · {chosen.layer}
          </legend>
          {AXES.map((label, index) => (
            <label key={label}>
              {label}
              <input
                aria-label={`Layout ${label}`}
                type="number"
                step="0.5"
                key={`${selected}-${chosen.position[index]}`}
                defaultValue={Number(chosen.position[index].toFixed(4))}
                disabled={locked}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (e.target.value && Number.isFinite(value)) {
                    move(
                      AXES.map((_, i) =>
                        i === index ? value - chosen.position[index] : 0
                      )
                    );
                  }
                }}
              />
            </label>
          ))}
          <label>
            Yaw override
            <input
              aria-label="Layout yaw override"
              type="number"
              step="1"
              disabled={locked}
              key={`${selected}-${yaw}`}
              defaultValue={String(yaw)}
              onBlur={(e) => {
                if (e.target.value && Number.isFinite(Number(e.target.value))) {
                  commit((before) =>
                    setLayout(
                      before,
                      section,
                      selected,
                      ['placement', 'override', 'rotate'],
                      Number(e.target.value)
                    )
                  );
                }
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={locked}
              disabled={inheritedLock}
              onChange={(e) =>
                commit((before) =>
                  setLayout(
                    before,
                    section,
                    selected,
                    ['locked'],
                    e.target.checked
                  )
                )
              }
            />
            Locked
          </label>
          <label>
            Mounting layer
            <select
              aria-label="Mounting layer"
              disabled={locked}
              value={chosen.layer}
              onChange={(e) =>
                commit((before) =>
                  setLayout(
                    before,
                    section,
                    selected,
                    ['layer'],
                    e.target.value
                  )
                )
              }
            >
              <option value="world">world</option>
              {Object.keys(report?.layers || {}).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
        </fieldset>
      )}
      <p role="status">
        {analysis.pending
          ? 'Resolving layout…'
          : analysis.stale
            ? 'Layout stale; waiting for valid source.'
            : `${items.length} objects · ${view === 'side' ? 'side envelopes' : 'top view'}. Drag to move; arrow keys move 1 mm.`}
      </p>
      {(error || analysis.error) && (
        <p role="alert">{error || analysis.error}</p>
      )}
      <svg
        ref={svg}
        aria-label="Interactive board layout"
        viewBox={`${low[0]} ${-high[1]} ${high[0] - low[0]} ${high[1] - low[1]}`}
        onPointerMove={(event) => {
          if (drag) {
            const next = point(event);
            setDrag({ ...drag, delta: next.map((v, i) => v - drag.start[i]) });
          }
        }}
        onPointerCancel={() => setDrag(null)}
        onPointerUp={() => {
          if (drag) {
            const change = drag;
            setDrag(null);
            if (change.source !== source) {
              setError('The source changed during this drag. Retry the move.');
              return;
            }
            move(change.delta);
          }
        }}
      >
        {items.map((item) => {
          const active =
            section === 'clusters'
              ? item.cluster === selected
              : item.id === selected;
          const delta = active && drag ? drag.delta : [0, 0, 0];
          return (
            <g
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${item.label}`}
              transform={`translate(${delta[0]} ${-delta[axis]})`}
              onClick={() =>
                setSelected(
                  section === 'clusters' ? item.cluster || '' : item.id
                )
              }
              onPointerDown={(event) => {
                const id =
                  section === 'clusters' ? item.cluster || '' : item.id;
                setSelected(id);
                if (blocked || collection[id]?.locked) {
                  return;
                }
                svg.current?.setPointerCapture(event.pointerId);
                setDrag({ id, start: point(event), delta: [0, 0, 0], source });
              }}
              onKeyDown={(event) => {
                if (!event.key.startsWith('Arrow') || !active) {
                  return;
                }
                event.preventDefault();
                const delta = [0, 0, 0];
                delta[
                  event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                    ? 0
                    : axis
                ] =
                  event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                    ? -1
                    : 1;
                move(delta);
              }}
            >
              <title>{`${item.label} · ${item.kind} · ${item.layer} · Z ${item.position[2].toFixed(2)} mm`}</title>
              {item.kind === 'anchor' ? (
                <path
                  d={`M ${item.position[0] - 1} ${-item.position[axis]} h 2 M ${item.position[0]} ${-item.position[axis] - 1} v 2`}
                  stroke={theme.colors.textDarker}
                />
              ) : (
                <polygon
                  points={polygon(item, view)}
                  fill={
                    active
                      ? theme.colors.accent
                      : item.kind === 'key'
                        ? theme.colors.infoDark
                        : theme.colors.warning
                  }
                  fillOpacity={0.25}
                  stroke={active ? theme.colors.accent : theme.colors.text}
                  strokeWidth={active ? 0.7 : 0.3}
                />
              )}
            </g>
          );
        })}
      </svg>
      {!!report?.findings.length && (
        <ul aria-label="Layout findings">
          {report.findings.map((finding, index) => (
            <li key={index}>{finding.message}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
