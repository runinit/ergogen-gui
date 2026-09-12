import type { LayoutReport } from 'ergogen/src/native';
import { snapEdges, type EdgeSnap } from './studioMove';
import type { SnapSpacing } from './snapSpacing';
import { DEFAULT_STEP, formatDimension } from './designUnits';

export interface SnapOptions {
  grid: boolean;
  centers: boolean;
  edges: boolean;
  step: number;
  millimetres: number;
  gap: number;
}
export const defaultSnapping: SnapOptions = {
  grid: true,
  centers: true,
  edges: true,
  step: DEFAULT_STEP,
  millimetres: 0,
  gap: 2,
};
export interface LayoutSnap extends EdgeSnap {
  axis?: 'x' | 'y';
  kind: 'grid' | 'center' | 'edge';
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];

// Reuse resolved geometry during pointer movement; no source parsing or generation here.
export function snapLayout(
  report: LayoutReport,
  ids: string[],
  delta: number[],
  options: SnapOptions,
  units: Record<string, number>,
  tolerance: number,
  spacing: SnapSpacing,
  parent?: number[],
  previous?: LayoutSnap
): LayoutSnap {
  const moving = report.objects[ids[0]];
  const result: LayoutSnap = {
    delta: [...delta],
    target: '',
    moving: ids[0],
    guides: [],
    label: '',
    kind: 'grid',
  };
  if (!moving) {
    return result;
  }
  if (options.grid) {
    const basis = parent || [1, 0, 0, 0, 0, 1, 0, 0];
    const proposed = [
      moving.position[0] + delta[0] - basis[3],
      moving.position[1] + delta[1] - basis[7],
    ];
    for (const axis of [0, 1]) {
      const direction = [basis[axis], basis[4 + axis]];
      if (Math.abs(dot(delta, direction)) < 1e-6) {
        continue;
      }
      const step =
        options.millimetres || options.step * units[axis === 0 ? 'u' : 'v'];
      if (!Number.isFinite(step) || step <= 0) {
        continue;
      }
      const position = dot(proposed, direction),
        correction = Math.round(position / step) * step - position;
      result.delta[0] += direction[0] * correction;
      result.delta[1] += direction[1] * correction;
    }
    result.label = options.millimetres
      ? `${options.millimetres} mm grid`
      : `${options.step}u × ${options.step}v grid`;
  }
  if (options.centers) {
    const candidates: {
      target: NonNullable<LayoutReport['guides']>[string];
      moving: string;
      axis: 'x' | 'y';
      correction: number;
      normal: number[];
      origin: number[];
    }[] = [];
    for (const id of ids) {
      const object = report.objects[id];
      const origin =
        report.guides?.[`${id}.center`]?.position || object.position;
      const proposed = [origin[0] + delta[0], origin[1] + delta[1]];
      for (const target of Object.values(report.guides || {})) {
        if (
          target.pcb !== object.pcb ||
          target.members.some((member) => ids.includes(member))
        ) {
          continue;
        }
        for (const axis of target.axes) {
          const index = axis === 'x' ? 0 : 1,
            tangent = [target.matrix[index], target.matrix[4 + index]],
            normal = [-tangent[1], tangent[0]];
          const correction = dot(
            [
              target.position[0] - proposed[0],
              target.position[1] - proposed[1],
            ],
            normal
          );
          const retained =
            previous?.target === target.id && previous.axis === axis;
          if (Math.abs(correction) <= tolerance * (retained ? 1.5 : 1)) {
            candidates.push({
              target,
              moving: id,
              axis,
              correction,
              normal,
              origin,
            });
          }
        }
      }
    }
    candidates.sort((a, b) => {
      const retained = (item: typeof a) =>
        previous?.target === item.target.id && previous.axis === item.axis
          ? 0
          : 1;
      return (
        retained(a) - retained(b) ||
        Math.abs(a.correction) - Math.abs(b.correction) ||
        a.target.axes.length - b.target.axes.length ||
        a.target.id.localeCompare(b.target.id)
      );
    });
    const chosen = candidates[0];
    if (chosen) {
      const wanted = [...result.delta];
      const correction = dot(
        [
          chosen.target.position[0] - chosen.origin[0] - wanted[0],
          chosen.target.position[1] - chosen.origin[1] - wanted[1],
        ],
        chosen.normal
      );
      wanted[0] += chosen.normal[0] * correction;
      wanted[1] += chosen.normal[1] * correction;
      const at = [chosen.origin[0] + wanted[0], chosen.origin[1] + wanted[1]];
      return {
        kind: 'center',
        delta: wanted.map(formatDimension),
        target: chosen.target.id,
        moving: chosen.moving,
        axis: chosen.axis,
        guides: [{ a: chosen.target.position, b: at }],
        label: `Centered on ${chosen.target.label}`,
      };
    }
  }
  const edge = options.edges
    ? snapEdges(report, ids, delta, options.gap, tolerance, spacing)
    : undefined;
  return edge
    ? { ...edge, kind: 'edge' }
    : { ...result, delta: result.delta.map(formatDimension) };
}
