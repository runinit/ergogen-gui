import type { FootprintInfo } from '../types/footprint';
const CIRCLE_STEPS = 64;
const EPSILON = 1e-9;
const TAU = Math.PI * 2;
type Point = number[];
export function graphicPoints(g: FootprintInfo['graphics'][number]): Point[] {
  if (g.type === 'line') {
    return [g.start, g.end];
  }
  if (g.type === 'rect') {
    return [
      g.start,
      [g.end[0], g.start[1]],
      g.end,
      [g.start[0], g.end[1]],
      g.start,
    ];
  }
  if (g.type === 'poly') {
    return [...g.points, g.points[0]].filter(Boolean);
  }
  if (g.type === 'curve' && g.points.length === 4) {
    return Array.from({ length: CIRCLE_STEPS + 1 }, (_, i) => {
      const t = i / CIRCLE_STEPS;
      return [0, 1].map(
        (axis) =>
          (1 - t) ** 3 * g.points[0][axis] +
          3 * (1 - t) ** 2 * t * g.points[1][axis] +
          3 * (1 - t) * t * t * g.points[2][axis] +
          t ** 3 * g.points[3][axis]
      );
    });
  }
  let center = g.center,
    start = g.end,
    sweep = TAU;
  if (g.type === 'arc' && g.mid.length === 2) {
    const [a, b, c] = [g.start, g.mid, g.end];
    const determinant =
      2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(determinant) < EPSILON) {
      return [a, b, c];
    }
    const squared = (p: Point) => p[0] ** 2 + p[1] ** 2;
    center = [
      (squared(a) * (b[1] - c[1]) +
        squared(b) * (c[1] - a[1]) +
        squared(c) * (a[1] - b[1])) /
        determinant,
      (squared(a) * (c[0] - b[0]) +
        squared(b) * (a[0] - c[0]) +
        squared(c) * (b[0] - a[0])) /
        determinant,
    ];
    start = a;
    const angle = (p: Point) => Math.atan2(p[1] - center[1], p[0] - center[0]);
    sweep = (angle(c) - angle(a) + TAU) % TAU;
    if ((angle(b) - angle(a) + TAU) % TAU > sweep) {
      sweep -= TAU;
    }
  } else if (g.type !== 'circle') {
    return [];
  }
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  const angle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  return Array.from({ length: CIRCLE_STEPS + 1 }, (_, i) => [
    center[0] + radius * Math.cos(angle + (sweep * i) / CIRCLE_STEPS),
    center[1] + radius * Math.sin(angle + (sweep * i) / CIRCLE_STEPS),
  ]);
}
export function padOutline(p: FootprintInfo['pads'][number]) {
  const [w, h] = p.size.map((value) => value / 2);
  const radius =
    p.shape === 'circle' || p.shape === 'oval'
      ? Math.min(w, h)
      : p.shape === 'roundrect'
        ? Math.min(w, h) * 2 * (p.roundrect || 0)
        : 0;
  return [
    [w - radius, h - radius],
    [-w + radius, h - radius],
    [-w + radius, -h + radius],
    [w - radius, -h + radius],
  ].flatMap(([x, y], corner) =>
    Array.from({ length: CIRCLE_STEPS / 4 + 1 }, (_, i) => {
      const angle = (corner * Math.PI) / 2 + (i * Math.PI) / (CIRCLE_STEPS / 2);
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
    })
  );
}

// KiCad pad angles include the placement rotation; stored back-side graphics are already mirrored.
export function footprintView(
  info: FootprintInfo | undefined,
  side: 'F' | 'B'
) {
  if (!info) {
    return undefined;
  }
  const mirror = (info.side || 'F') !== side ? -1 : 1;
  const point = (p: number[]) => (p.length ? [p[0], p[1] * mirror] : []);
  return {
    ...info,
    at: [0, 0, 0],
    side,
    pads: info.pads.map((pad) => ({
      ...pad,
      at: [...point(pad.at), ((pad.at[2] || 0) - (info.at?.[2] || 0)) * mirror],
    })),
    graphics: info.graphics.map((graphic) => ({
      ...graphic,
      start: point(graphic.start),
      end: point(graphic.end),
      mid: point(graphic.mid),
      center: point(graphic.center),
      points: graphic.points.map(point),
    })),
  };
}
