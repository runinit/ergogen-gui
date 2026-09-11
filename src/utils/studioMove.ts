import type { LayoutReport } from 'ergogen/src/native';
import { moveLayout, setLayout } from './layoutSource';
import { readStudio, moveColumn, getValue } from './studioSource';
import {
  includesObject,
  movingTargets,
  targets,
  type StudioSelection,
} from './studioTargets';
import {
  polygonPoints,
  edgeGap,
  hasSpacing,
  type SnapSpacing,
} from './snapSpacing';

const EPSILON = 0.001;
const PARALLEL = 0.999;
const PRECISION = 1e6;
const round = (value: number) => Math.round(value * PRECISION) / PRECISION;
export function moveTargets(
  source: string,
  selection: StudioSelection,
  delta: number[],
  report: LayoutReport
): string {
  let result = source;
  for (const target of movingTargets(source, selection)) {
    const frame =
      target.section === 'columns'
        ? report.clusters[target.cluster || '']
        : target.section === 'clusters'
          ? report.clusters[target.id]
          : report.objects[target.id];
    if (!frame || frame.locked) {
      throw new Error('A selected object is locked or unavailable.');
    }
    result =
      target.section === 'columns'
        ? moveColumn(
            result,
            target.cluster || '',
            target.id,
            delta,
            frame.matrix
          )
        : moveLayout(
            result,
            target.section as 'objects' | 'clusters',
            target.id,
            delta,
            frame.editMatrix
          );
  }
  return result;
}
export function movingIds(
  source: string,
  selection: StudioSelection,
  report: LayoutReport
): string[] {
  const data = readStudio(source);
  const ids = new Set(
    Object.values(report.objects)
      .filter((item) => includesObject(selection, item))
      .map((item) => item.id)
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, spec] of Object.entries(data.layout.objects || {})) {
      const parent = spec.placement?.ref
        ?.replace(/^objects\./, '')
        .split('.')[0];
      if (!ids.has(id) && parent && ids.has(parent)) {
        ids.add(id);
        changed = true;
      }
    }
  }
  return Array.from(ids);
}
export function attachmentReason(
  source: string,
  selection: StudioSelection
): string {
  if (targets(selection).length !== 1 || selection.section !== 'objects') {
    return 'Select one independent component to keep a relative placement.';
  }
  let item;
  try {
    item = readStudio(source).layout.objects?.[selection.id];
  } catch {
    return 'Resolve the configuration before attaching objects.';
  }
  if (
    !item ||
    item.kind !== 'component' ||
    item.properties?.owner ||
    item.cell ||
    item.index !== undefined
  ) {
    return 'Key assemblies retain their matrix and ownership relationships.';
  }
  if (
    item.placement?.solve?.length ||
    item.placement?.above ||
    item.placement?.below
  ) {
    return 'This component already has a solved or stacked placement.';
  }
  return '';
}
// Rebase a dropped component into its target frame while preserving its world pose.
export function attachObject(
  source: string,
  id: string,
  target: string,
  delta: number[],
  report: LayoutReport
): string {
  const reason = attachmentReason(source, { section: 'objects', id });
  if (reason) {
    throw new Error(reason);
  }
  const item = report.objects[id],
    parent = report.objects[target];
  if (
    !item ||
    !parent ||
    item.layer !== parent.layer ||
    item.pcb !== parent.pcb ||
    Math.abs(parent.matrix[10] - 1) > EPSILON ||
    Math.abs(item.matrix[10] - 1) > EPSILON
  ) {
    throw new Error(
      'Relative dragging needs objects on the same flat mounting layer and PCB.'
    );
  }
  if (movingIds(source, { section: 'objects', id }, report).includes(target)) {
    throw new Error('Relative placement would create a cycle.');
  }
  const difference = item.position.map(
    (value, axis) => value + delta[axis] - parent.position[axis]
  );
  const at = [0, 1, 2].map((axis) =>
    round(
      difference.reduce(
        (sum, value, row) => sum + parent.matrix[row * 4 + axis] * value,
        0
      )
    )
  );
  const yaw = (matrix: number[]) =>
    (Math.atan2(matrix[4], matrix[0]) * 180) / Math.PI;
  const old = (getValue(source, ['layout', 'objects', id, 'placement']) ||
    {}) as Record<string, unknown>;
  return setLayout(source, 'objects', id, ['placement'], {
    ...old,
    ref: target,
    at,
    rotate: round(yaw(item.matrix) - yaw(parent.matrix)),
    override: { at: [0, 0, 0], rotate: 0 },
  });
}
type Point = number[];
type Edge = { a: Point; b: Point; normal: Point; tangent: Point };
export interface EdgeSnap {
  delta: number[];
  target: string;
  moving: string;
  guides: { a: Point; b: Point }[];
  label: string;
}
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
function edges(points: Point[]): Edge[] {
  const winding =
    Math.sign(
      points.reduce((sum, a, index) => {
        const b = points[(index + 1) % points.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0)
    ) || 1;
  return points.flatMap((a, index) => {
    const b = points[(index + 1) % points.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < EPSILON) {
      return [];
    }
    const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return [
      { a, b, tangent, normal: [winding * tangent[1], -winding * tangent[0]] },
    ];
  });
}
// Compare real envelope edges, including rotated thumbs; tolerance is screen-scaled.
export function snapEdges(
  report: LayoutReport,
  ids: string[],
  delta: number[],
  gap: number,
  tolerance: number,
  spacing: SnapSpacing = Object.fromEntries(
    Object.keys(report.objects).map((id) => [id, [gap, gap]])
  )
): EdgeSnap | undefined {
  const polygons = Object.values(report.objects)
    .filter((item) => item.kind !== 'anchor')
    .map((item) => ({
      item,
      edges: edges(polygonPoints(item)),
    }));
  const candidates: {
    distance: number;
    normal: Point;
    target: string;
    moving: string;
    a: Point;
    b: Point;
    gap: number;
  }[] = [];
  for (const moving of polygons.filter(({ item }) => ids.includes(item.id))) {
    for (const fixed of polygons.filter(
      ({ item }) =>
        !ids.includes(item.id) &&
        item.pcb === moving.item.pcb &&
        item.layer === moving.item.layer
    )) {
      for (const from of moving.edges) {
        const a = from.a.map((value, index) => value + delta[index]);
        const b = from.b.map((value, index) => value + delta[index]);
        for (const to of fixed.edges) {
          const facing = dot(from.normal, to.normal);
          if (Math.abs(facing) < PARALLEL) {
            continue;
          }
          const required =
            moving.item.kind === 'key' && fixed.item.kind === 'key'
              ? Math.max(
                  edgeGap(moving.item, from.normal, gap, spacing),
                  edgeGap(fixed.item, to.normal, gap, spacing)
                )
              : gap;
          if (!Number.isFinite(required)) {
            continue;
          }
          const wanted = facing < 0 ? required : 0;
          const distance =
            dot([to.a[0] - a[0], to.a[1] - a[1]], from.normal) - wanted;
          if (Math.abs(distance) > tolerance) {
            continue;
          }
          const bounds = (p: Point, q: Point) => [
            Math.min(dot(p, from.tangent), dot(q, from.tangent)),
            Math.max(dot(p, from.tangent), dot(q, from.tangent)),
          ];
          const left = bounds(a, b),
            right = bounds(to.a, to.b);
          if (
            Math.min(left[1], right[1]) <
            Math.max(left[0], right[0]) - tolerance
          ) {
            continue;
          }
          candidates.push({
            distance,
            normal: from.normal,
            target: fixed.item.id,
            moving: moving.item.id,
            a: to.a,
            b: to.b,
            gap: wanted,
          });
        }
      }
    }
  }
  candidates.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
  for (const first of candidates) {
    // Try a corner alignment, then one edge; neither may crowd another neighbour.
    const second = candidates.find(
      (item) =>
        item.target === first.target &&
        Math.abs(dot(item.normal, first.normal)) < EPSILON
    );
    for (const selected of second ? [[first, second], [first]] : [[first]]) {
      const change = [...delta];
      for (const candidate of selected) {
        change[0] += candidate.normal[0] * candidate.distance;
        change[1] += candidate.normal[1] * candidate.distance;
      }
      if (!hasSpacing(report, ids, change, gap, spacing)) {
        continue;
      }
      return {
        delta: change.map(round),
        target: first.target,
        moving: first.moving,
        guides: selected.map(({ a, b }) => ({ a, b })),
        label: `${report.objects[first.target].label} · ${first.gap ? `${round(first.gap)} mm edge gap` : 'edges aligned'}`,
      };
    }
  }
  return undefined;
}
