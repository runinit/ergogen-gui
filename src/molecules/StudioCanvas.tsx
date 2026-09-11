import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LayoutReport } from 'ergogen/src/native';
import type { IModel } from 'makerjs';
import { layoutPolygon } from '../utils/layoutDrawing';
import { Drawing } from './CasePlanPreview';
import { theme } from '../theme/theme';
import CanvasTools from './CanvasTools';
import { layoutSpacing, hasSpacing } from '../utils/snapSpacing';
import { useLayoutAnalysis } from '../hooks/useCasePreview';
import {
  moveTargets,
  movingIds,
  snapEdges,
  attachObject,
  attachmentReason,
  type EdgeSnap,
} from '../utils/studioMove';
import {
  includesObject,
  targets,
  sameTarget,
  selectTargets,
  selectionMode,
  type StudioSelection,
} from '../utils/studioTargets';
export type { StudioSelection } from '../utils/studioTargets';
import type { StudioRule } from '../utils/studioSource';

type Box = { x: number; y: number; w: number; h: number };
const DRAG_THRESHOLD = 4,
  SNAP_PIXELS = 8,
  PAD = 14,
  MIN_SIZE = 40,
  ZOOM_STEP = 1.25,
  MIN_SCALE = 0.1,
  MAX_SCALE = 5,
  MOVE_TOLERANCE = 0.01;
export default function StudioCanvas({
  report,
  quickEdit,
  selection,
  onSelect,
  onQuickEdit,
  onMove,
  onDelete,
  stale,
  source,
  model,
  side,
  onSide,
  rules,
  injections,
}: {
  report?: LayoutReport;
  quickEdit?: ReactNode;
  injections?: string[][];
  selection: StudioSelection;
  onSelect: (value: StudioSelection, panel?: 'inspect' | 'keep') => void;
  onQuickEdit?: (value: StudioSelection, intent?: 'select' | 'focus') => void;
  onMove: (
    selection: StudioSelection,
    delta: number[],
    source: string,
    candidate?: string
  ) => boolean | void;
  onDelete?: () => void;
  stale: boolean;
  source: string;
  model?: IModel;
  side: 'top' | 'side';
  onSide: (view: 'top' | 'side') => void;
  rules: Record<string, StudioRule>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState('select');
  // Selection changes must not replace the tool chosen for the next click.
  const [scope, setScope] = useState(() =>
    ['columns', 'clusters'].includes(selection.section)
      ? selection.section
      : 'keys'
  );
  const [snapping, setSnapping] = useState(true);
  const [gap, setGap] = useState(2);
  const [relative, setRelative] = useState(false);
  const clicked = useRef<StudioSelection | null>(null);
  const [committed, setCommitted] = useState<{
    source: string;
    report: LayoutReport;
  } | null>(null);
  const spacing = useMemo(() => {
    try {
      return report ? layoutSpacing(source, report) : {};
    } catch {
      return {};
    }
  }, [source, report]);
  useEffect(() => {
    if (committed && (source !== committed.source || !stale)) {
      setCommitted(null);
    }
  }, [source, stale, committed]);
  const items = Object.values(report?.objects || {}).filter(
    (item) => item.kind !== 'anchor'
  );
  const axis = side === 'top' ? 1 : 2;
  const fit = useMemo(() => {
    const points = items.flatMap((item) =>
      layoutPolygon(item, side)
        .split(' ')
        .filter(Boolean)
        .map((pair) => pair.split(',').map(Number))
    );
    const low = [0, 1].map((index) =>
      points.length ? Math.min(...points.map((p) => p[index])) : 0
    );
    const high = [0, 1].map((index) =>
      points.length ? Math.max(...points.map((p) => p[index])) : MIN_SIZE
    );
    return {
      x: low[0] - PAD,
      y: low[1] - PAD,
      w: Math.max(MIN_SIZE, high[0] - low[0]) + 2 * PAD,
      h: Math.max(MIN_SIZE, high[1] - low[1]) + 2 * PAD,
    };
    // Geometry updates keep the camera; Fit explicitly follows edited bounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, side]);
  const [camera, setCamera] = useState<Box | null>(null);
  const objectIds = Object.keys(report?.objects || {})
    .sort()
    .join('|');
  useEffect(() => {
    setCamera(null);
  }, [objectIds]);
  const box = camera || fit;
  const liveBox = useRef(box);
  liveBox.current = box;
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    box: Box;
    points: { x: number; y: number }[];
  } | null>(null);
  const [drag, setDrag] = useState<{
    selection: StudioSelection;
    start: number[];
    screen: number[];
    snap?: EdgeSnap;
    attach?: string;
    delta: number[];
    source: string;
    phase: 'moving' | 'released';
    checkSpacing?: boolean;
  } | null>(null);
  const [moveError, setMoveError] = useState('');
  const proposal = useMemo(() => {
    if (
      !drag ||
      drag.phase !== 'released' ||
      drag.source !== source ||
      !report
    ) {
      return { source: '', error: '' };
    }
    try {
      if (
        drag.checkSpacing &&
        !hasSpacing(
          report,
          movingIds(source, drag.selection, report),
          drag.delta,
          gap,
          spacing
        )
      ) {
        throw new Error(
          'Not enough room for the configured spacing. Move farther away or turn off snapping.'
        );
      }
      return {
        source: drag.attach
          ? attachObject(
              source,
              drag.selection.id,
              drag.attach,
              drag.delta,
              report
            )
          : moveTargets(source, drag.selection, drag.delta, report),
        error: '',
      };
    } catch (error) {
      return { source: '', error: String(error) };
    }
  }, [drag, source, report, gap, spacing]);
  const candidate = proposal.source;
  const preview = useLayoutAnalysis(candidate, injections, !!candidate);
  const previewReady =
    !!candidate && !preview.stale && !preview.pending && !preview.error;
  const visible = previewReady
    ? preview.result?.layout || report
    : committed?.report || report;
  const drawn = Object.values(visible?.objects || {}).filter(
    (item) => item.kind !== 'anchor'
  );
  const dragSource = drag?.source,
    dragSelection = drag?.selection;
  const draggedIds = useMemo(() => {
    if (!dragSource || !dragSelection || !report) {
      return [];
    }
    try {
      return movingIds(dragSource, dragSelection, report);
    } catch {
      return Object.values(report.objects)
        .filter((item) => includesObject(dragSelection, item))
        .map((item) => item.id);
    }
  }, [dragSource, dragSelection, report]);
  useEffect(() => {
    if (!drag || drag.phase !== 'released') {
      return;
    }
    if (drag.source !== source || !candidate || preview.error) {
      setMoveError(
        proposal.error ||
          preview.error ||
          'The project changed. Retry the move.'
      );
      setDrag(null);
      return;
    }
    if (previewReady) {
      const checked = preview.result?.layout;
      const blocked = draggedIds.find((id) => {
        const before = report?.objects[id],
          after = checked?.objects[id];
        return (
          before &&
          (!after ||
            before.position.some(
              (value, axis) =>
                Math.abs(value + drag.delta[axis] - after.position[axis]) >
                MOVE_TOLERANCE
            ))
        );
      });
      if (!checked || blocked) {
        setMoveError(
          blocked
            ? `Placement constraints hold ${blocked}. Adjust its constraints before moving it.`
            : 'The moved layout could not be validated.'
        );
      } else if (
        onMove(drag.selection, drag.delta, drag.source, candidate) === false
      ) {
        setMoveError('The project changed during this move. Retry.');
      } else {
        // Keep the accepted pose visible until the main analysis catches up.
        setCommitted({ source: candidate, report: checked });
        onQuickEdit?.(drag.selection);
      }
      setDrag(null);
    }
  }, [
    drag,
    candidate,
    previewReady,
    preview.error,
    proposal.error,
    preview.result,
    draggedIds,
    report,
    onQuickEdit,
    onMove,
    source,
  ]);
  const convert = (x: number, y: number) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) {
      return [0, 0, 0];
    }
    const p = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    return side === 'top' ? [p.x, -p.y, 0] : [p.x, 0, -p.y];
  };
  const zoom = (factor: number, px?: number, py?: number) => {
    const current = liveBox.current,
      base = fitRef.current;
    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, (current.w / base.w) * factor)
    );
    const ratio = (scale * base.w) / current.w;
    const x = px ?? current.x + current.w / 2,
      y = py ?? current.y + current.h / 2;
    setCamera({
      x: x + (current.x - x) * ratio,
      y: y + (current.y - y) * ratio,
      w: current.w * ratio,
      h: current.h * ratio,
    });
  };
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const node = svg.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = node?.getScreenCTM();
      if (!matrix) {
        return;
      }
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse()
      );
      zoomRef.current(event.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP, p.x, p.y);
    };
    node?.addEventListener('wheel', wheel, { passive: false });
    return () => node?.removeEventListener('wheel', wheel);
  }, []);
  const pick = (item: NonNullable<LayoutReport['objects'][string]>) => {
    const sameCluster =
      selection.section === 'clusters' && item.cluster === selection.id;
    const sameColumn =
      selection.section === 'columns' &&
      item.cluster === selection.cluster &&
      item.cell?.[0] === selection.id;
    const next: StudioSelection =
      tool === 'move' && (sameCluster || sameColumn)
        ? selection
        : scope === 'columns' && item.cell && item.cluster
          ? {
              section: 'columns',
              cluster: item.cluster,
              id: item.cell[0],
            }
          : scope === 'clusters' && item.cluster
            ? { section: 'clusters', id: item.cluster }
            : { section: 'objects', id: item.id };
    return next;
  };
  const reset = () => {
    setCamera(null);
    gesture.current = null;
    setDrag(null);
  };
  const startGesture = () => {
    gesture.current = {
      box: { ...liveBox.current },
      points: Array.from(pointers.current.values()),
    };
  };
  const end = (id: number, commit: 'commit' | 'cancel') => {
    if (
      drag &&
      commit === 'commit' &&
      pointers.current.size === 1 &&
      drag.delta.some((value) => Math.abs(value) > 0.001)
    ) {
      setDrag({ ...drag, phase: 'released' });
    } else {
      setDrag(null);
      if (
        commit === 'commit' &&
        pointers.current.size === 1 &&
        clicked.current
      ) {
        onQuickEdit?.(clicked.current);
      }
    }
    clicked.current = null;
    pointers.current.delete(id);
    gesture.current = null;
    if (pointers.current.size) {
      startGesture();
    }
  };
  return (
    <>
      <CanvasTools
        tool={tool}
        setTool={setTool}
        scope={scope}
        setScope={setScope}
        side={side}
        setSide={onSide}
        reset={reset}
        zoom={(direction) =>
          zoom(direction === 'in' ? 1 / ZOOM_STEP : ZOOM_STEP)
        }
        scale={Math.round((fit.w / box.w) * 100)}
        snapping={snapping}
        setSnapping={setSnapping}
        gap={gap}
        setGap={setGap}
        relative={relative}
        setRelative={setRelative}
        relativeReason={attachmentReason(source, selection)}
        quickEdit={quickEdit}
        onDelete={selection.id && !stale ? onDelete : undefined}
      />
      {(drag || moveError) && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: theme.studio.dragStatusBottom,
            left: theme.spacing.sm,
            padding: theme.spacing.sm,
            background: theme.colors.background,
            pointerEvents: 'none',
          }}
        >
          {moveError ||
            (drag?.phase === 'released'
              ? 'Checking placement…'
              : drag?.snap
                ? `${drag.snap.label}${drag.attach ? ' · keep relative' : ''}`
                : 'Drag to move · Alt bypasses snap · Esc cancels')}
        </div>
      )}
      <svg
        ref={svg}
        aria-label="Interactive board layout"
        role="group"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setDrag(null);
            clicked.current = null;
            setMoveError('');
          }
        }}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        style={{
          width: '100%',
          minHeight: 0,
          flex: 1,
          touchAction: 'none',
          cursor: tool === 'pan' ? 'grab' : drag ? 'grabbing' : 'default',
        }}
        onPointerDown={(event) => {
          if (event.button > 1 || drag?.phase === 'released') {
            return;
          }
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          svg.current?.setPointerCapture(event.pointerId);
          if (pointers.current.size > 1) {
            setDrag(null);
            clicked.current = null;
            startGesture();
            return;
          }
          const id = (event.target as Element)
            .closest('[data-object]')
            ?.getAttribute('data-object');
          const item = id ? report?.objects[id] : undefined;
          if (item && tool !== 'pan' && event.button !== 1) {
            const picked = pick(item);
            const mode = selectionMode(event);
            const order = Array.from(
              new Map(
                items.map((value) => {
                  const target = pick(value);
                  return [JSON.stringify(target), target];
                })
              ).values()
            );
            const next =
              mode === 'replace' &&
              targets(selection).some((target) => sameTarget(target, picked))
                ? selection
                : selectTargets(selection, picked, mode, order);
            onSelect(next, 'keep');
            clicked.current = next;
            svg.current?.focus();
            if (mode !== 'replace') {
              return;
            }
            if (!stale && !item.locked) {
              setCamera({ ...liveBox.current });
              setDrag({
                selection: next,
                start: convert(event.clientX, event.clientY),
                screen: [event.clientX, event.clientY],
                delta: [0, 0, 0],
                source,
                phase: 'moving',
              });
              setMoveError('');
            }
            return;
          }
          if (tool === 'select' && event.button !== 1) {
            onSelect({ section: 'objects', id: '' }, 'keep');
          }
          startGesture();
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) {
            return;
          }
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (drag?.phase === 'moving' && pointers.current.size === 1) {
            if (
              Math.hypot(
                event.clientX - drag.screen[0],
                event.clientY - drag.screen[1]
              ) < DRAG_THRESHOLD &&
              !drag.delta.some(Boolean)
            ) {
              return;
            }
            const next = convert(event.clientX, event.clientY);
            const delta = next.map((v, i) => v - drag.start[i]);
            const matrix = svg.current?.getScreenCTM();
            const tolerance =
              SNAP_PIXELS /
              Math.max(0.01, Math.hypot(matrix?.a || 1, matrix?.b || 0));
            const snap =
              snapping && !event.altKey && side === 'top' && report
                ? snapEdges(report, draggedIds, delta, gap, tolerance, spacing)
                : undefined;
            const attach =
              relative && snap && !attachmentReason(source, drag.selection)
                ? snap.target
                : undefined;
            clicked.current = null;
            setDrag({
              ...drag,
              delta: snap?.delta || delta,
              snap,
              attach,
              checkSpacing: snapping && !event.altKey && side === 'top',
            });
            return;
          }
          const start = gesture.current,
            node = svg.current;
          if (!start || !node) {
            return;
          }
          const points = Array.from(pointers.current.values());
          const center = (p: { x: number; y: number }[]) => ({
            x: p.reduce((sum, v) => sum + v.x, 0) / p.length,
            y: p.reduce((sum, v) => sum + v.y, 0) / p.length,
          });
          const before = center(start.points),
            after = center(points);
          const distance = (p: { x: number; y: number }[]) =>
            p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 1;
          const ratio =
            points.length > 1 && start.points.length > 1
              ? distance(start.points) / Math.max(1, distance(points))
              : 1;
          const scale = Math.max(
            MIN_SCALE,
            Math.min(MAX_SCALE, (start.box.w / fit.w) * ratio)
          );
          const w = fit.w * scale,
            h = (start.box.h * w) / start.box.w;
          const rect = node.getBoundingClientRect(),
            units = Math.max(
              start.box.w / rect.width,
              start.box.h / rect.height
            );
          setCamera({
            x:
              start.box.x +
              (start.box.w - w) / 2 -
              (after.x - before.x) * units,
            y:
              start.box.y +
              (start.box.h - h) / 2 -
              (after.y - before.y) * units,
            w,
            h,
          });
        }}
        onPointerUp={(event) => end(event.pointerId, 'commit')}
        onPointerCancel={(event) => end(event.pointerId, 'cancel')}
      >
        <defs>
          <pattern
            id="studio-grid"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 5 0 L 0 0 0 5"
              fill="none"
              stroke={theme.studio.grid}
              strokeWidth="0.12"
            />
          </pattern>
        </defs>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill="url(#studio-grid)"
        />
        {side === 'top' && model && (
          <g transform="scale(1,-1)" pointerEvents="none">
            <Drawing model={model} color={theme.studio.outline} />
          </g>
        )}
        {drawn.map((item) => {
          const active = includesObject(selection, item);
          const delta =
            drag && !previewReady && draggedIds.includes(item.id)
              ? drag.delta
              : [0, 0, 0];
          return (
            <g
              key={item.id}
              data-object={item.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${item.label}`}
              aria-describedby={
                item.cell ? `studio-${item.id}-cell` : undefined
              }
              aria-pressed={active}
              onContextMenu={(event) => {
                event.preventDefault();
                onQuickEdit?.(
                  includesObject(selection, item) ? selection : pick(item),
                  'focus'
                );
              }}
              onDoubleClick={() =>
                onQuickEdit?.(
                  includesObject(selection, item) ? selection : pick(item),
                  'focus'
                )
              }
              transform={`translate(${delta[0]},${-delta[axis]})`}
              onKeyDown={(event) => {
                if (event.key === 'F10' && event.shiftKey) {
                  event.preventDefault();
                  onQuickEdit?.(
                    includesObject(selection, item) ? selection : pick(item),
                    'focus'
                  );
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  const next = pick(item);
                  const order = items.map(pick);
                  const selected = selectTargets(
                    selection,
                    next,
                    selectionMode(event),
                    order
                  );
                  onSelect(selected, 'keep');
                  onQuickEdit?.(selected);
                }
                if (
                  !active ||
                  stale ||
                  item.locked ||
                  !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                    event.key
                  )
                ) {
                  return;
                }
                event.preventDefault();
                const delta = [0, 0, 0];
                delta[
                  event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                    ? 0
                    : axis
                ] =
                  (event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                    ? -1
                    : 1) * (event.shiftKey ? 5 : 1);
                setCamera({ ...liveBox.current });
                setDrag({
                  selection,
                  start: [0, 0, 0],
                  screen: [0, 0],
                  delta,
                  source,
                  phase: 'released',
                });
              }}
            >
              {item.cell && (
                <desc id={`studio-${item.id}-cell`}>
                  Column {item.cell[0]}, row {item.cell[1]}
                </desc>
              )}
              <polygon
                points={layoutPolygon(item, side)}
                fill={active ? theme.colors.accent : theme.colors.background}
                fillOpacity={active ? 0.15 : 0.65}
                stroke={
                  active
                    ? theme.colors.accent
                    : item.kind === 'key'
                      ? theme.studio.key
                      : theme.studio.component
                }
                strokeWidth={active ? 0.45 : 0.22}
              />
              {active && (
                <circle
                  cx={item.position[0]}
                  cy={-item.position[axis]}
                  r=".45"
                  fill={theme.colors.accent}
                />
              )}
            </g>
          );
        })}
        {drag?.snap &&
          drag.snap.guides.map((guide, index) => (
            <line
              key={`snap-${index}`}
              x1={guide.a[0]}
              y1={-guide.a[1]}
              x2={guide.b[0]}
              y2={-guide.b[1]}
              stroke={theme.colors.accent}
              strokeWidth=".4"
              strokeDasharray="1 1"
              pointerEvents="none"
            />
          ))}
        {side === 'top' &&
          Object.entries(rules)
            .filter(([id, rule]) =>
              selection.section === 'constraints'
                ? selection.id === id
                : rule.refs.some(
                    (ref) =>
                      ref === selection.id ||
                      ref === `${selection.section}.${selection.id}`
                  )
            )
            .map(([id, rule]) => {
              const refs = rule.refs.map((ref) =>
                ref.startsWith('clusters.')
                  ? visible?.clusters[ref.slice(9)]
                  : visible?.objects[
                      ref.replace(/^objects\./, '').replace(/\.origin$/, '')
                    ]
              );
              if (!refs[0] || !refs[1]) {
                return null;
              }
              const [a, b] = refs as NonNullable<(typeof refs)[number]>[];
              return (
                <g key={id} pointerEvents="none">
                  <line
                    x1={a.position[0]}
                    y1={-a.position[1]}
                    x2={b.position[0]}
                    y2={-b.position[1]}
                    stroke={theme.colors.accent}
                    strokeWidth=".3"
                    strokeDasharray="1 1"
                  />
                  <text
                    x={(a.position[0] + b.position[0]) / 2}
                    y={-(a.position[1] + b.position[1]) / 2 - 2}
                    fill={theme.colors.accent}
                    fontSize="2.5"
                    textAnchor="middle"
                  >
                    {rule.label || id}
                    {rule.value !== undefined ? ` = ${rule.value}` : ''}
                  </text>
                </g>
              );
            })}
      </svg>
    </>
  );
}
