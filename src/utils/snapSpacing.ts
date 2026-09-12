import { mathnum } from 'ergogen/src/assert';
import type { LayoutReport, ResolvedObject } from 'ergogen/src/native';
import { readStudio } from './studioSource';
import { keyOptions } from './keyOptions';
import { layoutPolygon } from './layoutDrawing';

export type SnapSpacing = Record<string, number[] | undefined>;
const EPSILON = 0.0001;
// Use the native expression evaluator so snapping shares the layout units.
export function layoutSpacing(
  source: string,
  report: LayoutReport
): SnapSpacing {
  const data = readStudio(source);
  const numeric = new Map<number | string, number>();
  const number = (value: number | string): number => {
    if (typeof value === 'number') {
      return value;
    }
    if (!numeric.has(value)) {
      try {
        const result = mathnum(value)({ ...report.units });
        numeric.set(value, typeof result === 'number' ? result : NaN);
      } catch {
        numeric.set(value, NaN);
      }
    }
    return numeric.get(value)!;
  };
  const optionCache = new Map<string, ReturnType<typeof keyOptions>>();
  return Object.fromEntries(
    Object.values(report.objects)
      .filter((item) => item.kind === 'key')
      .map((item) => {
        const key = JSON.stringify([item.cluster, item.cell?.[0]]);
        if (!optionCache.has(key)) {
          optionCache.set(
            key,
            keyOptions(source, item.cluster, item.cell?.[0])
          );
        }
        const options = optionCache.get(key)!;
        const cluster = data.layout.clusters?.[item.cluster || ''];
        const pitch =
          cluster?.arrangement?.pitch ||
          data.layout.clusters?.[cluster?.mirror?.source || '']?.arrangement
            ?.pitch ||
          options.pitch;
        const part = data.parts?.[item.part || ''];
        const base =
          part?.envelopes?.keycap?.size ||
          part?.envelopes?.body?.size ||
          part?.envelopes?.pcb?.size ||
          options.size;
        const spacing = [0, 1].map((axis) =>
          Math.max(0, number(pitch[axis]) - number(base[axis]))
        );
        return [item.id, spacing.every(Number.isFinite) ? spacing : undefined];
      })
  );
}
type Point = number[];
export function polygonPoints(item: ResolvedObject): Point[] {
  return layoutPolygon(item, 'top')
    .split(' ')
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return [x, -y];
    });
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function inside(point: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      result = !result;
    }
  }
  return result;
}
function segmentGap(p: Point, a: Point, b: Point) {
  const length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
            length
        )
      )
    : 0;
  const normal = [
    p[0] - a[0] - t * (b[0] - a[0]),
    p[1] - a[1] - t * (b[1] - a[1]),
  ];
  return { distance: Math.hypot(...normal), normal };
}
function polygonGap(left: Point[], right: Point[]) {
  if (!left.length || !right.length) {
    return { distance: Infinity, normal: [1, 0] };
  }
  if (inside(left[0], right) || inside(right[0], left)) {
    return { distance: -1, normal: [1, 0] };
  }
  let closest = { distance: Infinity, normal: [1, 0] };
  for (let i = 0; i < left.length; i++) {
    const a = left[i],
      b = left[(i + 1) % left.length];
    for (let j = 0; j < right.length; j++) {
      const c = right[j],
        d = right[(j + 1) % right.length];
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      ) {
        return { distance: -1, normal: [1, 0] };
      }
      for (const candidate of [
        segmentGap(a, c, d),
        segmentGap(b, c, d),
        segmentGap(c, a, b),
        segmentGap(d, a, b),
      ]) {
        if (candidate.distance < closest.distance) {
          closest = candidate;
        }
      }
    }
  }
  return closest;
}
export function edgeGap(
  item: ResolvedObject,
  normal: Point,
  gap: number,
  spacing: SnapSpacing
): number {
  if (item.kind !== 'key') {
    return gap;
  }
  const gaps = spacing[item.id];
  if (!gaps) {
    return NaN;
  }
  const axis =
    Math.abs(normal[0] * item.matrix[0] + normal[1] * item.matrix[4]) >=
    Math.abs(normal[0] * item.matrix[1] + normal[1] * item.matrix[5])
      ? 0
      : 1;
  return gaps[axis];
}
// Key pitch constrains keys; component placement is checked by layout analysis.
export function hasSpacing(
  report: LayoutReport,
  ids: string[],
  delta: number[],
  gap: number,
  spacing: SnapSpacing
): boolean {
  const objects = Object.values(report.objects).filter(
    (item) => item.kind === 'key'
  );
  for (const item of objects.filter((item) => ids.includes(item.id))) {
    const left = polygonPoints(item).map((p) => [
      p[0] + delta[0],
      p[1] + delta[1],
    ]);
    for (const other of objects.filter(
      (other) =>
        !ids.includes(other.id) &&
        other.pcb === item.pcb &&
        other.layer === item.layer
    )) {
      const closest = polygonGap(left, polygonPoints(other));
      const required =
        item.kind === 'key' && other.kind === 'key'
          ? Math.max(
              edgeGap(item, closest.normal, gap, spacing),
              edgeGap(other, closest.normal, gap, spacing)
            )
          : gap;
      if (!Number.isFinite(required) || closest.distance < required - EPSILON) {
        return false;
      }
    }
  }
  return true;
}
