import makerjs, { IModel } from 'makerjs';
import { Vec2 } from '../types/design';

export enum GeometryRole {
  Construction = 'construction',
  Profile = 'profile',
}
const POINT_TOLERANCE = 0.000001;

export function independentSketch(model: IModel) {
  const points: Record<string, { at: number[] }> = {};
  const geometry: Record<string, unknown> = {};
  let serial = 0;
  const point = (input: makerjs.IPoint) => {
    const at = [input[0], input[1]];
    const existing = Object.entries(points).find(
      ([, point]) =>
        makerjs.measure.pointDistance(point.at, at) < POINT_TOLERANCE
    );
    if (existing) {
      return existing[0];
    }
    const id = `point_${++serial}`;
    points[id] = { at };
    return id;
  };
  makerjs.model.walk(model, {
    onPath: ({ pathContext, offset }) => {
      const path = makerjs.path.moveRelative(
        makerjs.path.clone(pathContext),
        offset
      );
      const id = `edge_${Object.keys(geometry).length + 1}`;
      const ends = makerjs.point.fromPathEnds(path);
      if (path.type === 'line') {
        geometry[id] = { type: 'line', points: ends.map(point) };
      } else if (path.type === 'circle') {
        geometry[id] = {
          type: 'circle',
          center: point(path.origin),
          radius: (path as makerjs.IPathCircle).radius,
        };
      } else if (path.type === 'arc') {
        geometry[id] = {
          type: 'arc',
          center: point(path.origin),
          start: point(ends[0]),
          end: point(ends[1]),
          radius: (path as makerjs.IPathArc).radius,
        };
      }
    },
  });
  return { points, geometry };
}

export function drawnGeometry(
  type: string,
  clicks: Vec2[],
  id: string,
  role: GeometryRole
) {
  const construction = role === GeometryRole.Construction;
  const names = clicks.map((_, index) => `${id}_p${index + 1}`);
  const points = Object.fromEntries(
    clicks.map((at, index) => [names[index], { at }])
  );
  let geometry: unknown = { type, points: names, construction };
  if (type === 'circle') {
    geometry = {
      type,
      center: names[0],
      radius: makerjs.measure.pointDistance(clicks[0], clicks[1]),
      construction,
    };
  }
  if (type === 'arc') {
    geometry = {
      type,
      center: names[0],
      start: names[1],
      end: names[2],
      radius: makerjs.measure.pointDistance(clicks[0], clicks[1]),
      construction,
    };
  }
  return { points, geometry: { [id]: geometry } };
}
