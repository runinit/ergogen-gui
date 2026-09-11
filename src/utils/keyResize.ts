import type { LayoutReport } from 'ergogen/src/native';
import { getValue, readStudio } from './studioSource';
import { setLayout } from './layoutSource';

type Dimension = number | string;
export type KeyAlignment = {
  x: 'auto' | 'left' | 'center' | 'right';
  y: 'top' | 'center' | 'bottom';
};
const PRECISION = 1_000_000;
const DEGREES = Math.PI / 180;

export function resizeKey(
  source: string,
  id: string,
  size: Dimension[],
  report?: LayoutReport,
  alignment?: KeyAlignment
): string {
  const data = readStudio(source);
  const item = data.layout.objects?.[id];
  const columns =
    data.layout.clusters?.[item?.cluster || '']?.arrangement?.columns || [];
  const prior = (item?.properties?.key_alignment || {
    x: 'auto',
    y: 'top',
  }) as KeyAlignment;
  const chosen = alignment || prior;
  const factors = (value: KeyAlignment) => {
    const horizontal =
      value.x === 'auto'
        ? columns.length > 1 && item?.cell?.[0] === columns.at(-1)
          ? 'right'
          : 'left'
        : value.x;
    return [
      { left: 0.5, center: 0, right: -0.5 }[horizontal],
      { top: -0.5, center: 0, bottom: 0.5 }[value.y],
    ];
  };
  const beforeFactors = factors(prior),
    afterFactors = factors(chosen);
  const base = (getValue(source, [
    'parts',
    item?.part || '',
    'envelopes',
    'keycap',
    'size',
  ]) || [18, 18]) as Dimension[];
  const old = item?.envelopes?.keycap?.size ||
    getValue(source, [
      'parts',
      item?.part || '',
      'envelopes',
      'keycap',
      'size',
    ]) || [18, 18];
  const previous = old as Dimension[];
  const resolved = report?.objects[id];
  const angle =
    Number(item?.placement?.rotate || 0) +
    Number(
      getValue(source, [
        'layout',
        'objects',
        id,
        'placement',
        'override',
        'rotate',
      ]) || 0
    );
  if (!resolved && !Number.isFinite(angle)) {
    throw new Error('Resolve the layout before resizing a rotated key.');
  }
  // Anchor size changes in the key's axes, not the world's axes.
  const axes = resolved
    ? [0, 1, 2].map((axis) =>
        [0, 1].map((keyAxis) =>
          [0, 1, 2].reduce(
            (sum, row) =>
              sum +
              resolved.editMatrix[row * 4 + axis] *
                resolved.matrix[row * 4 + keyAxis],
            0
          )
        )
      )
    : [
        [Math.cos(angle * DEGREES), -Math.sin(angle * DEGREES)],
        [Math.sin(angle * DEGREES), Math.cos(angle * DEGREES)],
        [0, 0],
      ];
  const current = (getValue(source, [
    'layout',
    'objects',
    id,
    'placement',
    'override',
    'at',
  ]) || [0, 0, 0]) as Dimension[];
  const at = axes.map((coefficients, axis) => {
    let value: Dimension = current[axis] ?? 0;
    coefficients.forEach((coefficient, dimension) => {
      const factor =
        Math.round(coefficient * afterFactors[dimension] * PRECISION) /
        PRECISION;
      const oldFactor =
        Math.round(coefficient * beforeFactors[dimension] * PRECISION) /
        PRECISION;
      if (
        (!factor && !oldFactor) ||
        (size[dimension] === previous[dimension] && factor === oldFactor)
      ) {
        return;
      }
      const next = size[dimension],
        old = previous[dimension];
      value =
        typeof value === 'number' &&
        typeof next === 'number' &&
        typeof old === 'number' &&
        typeof base[dimension] === 'number'
          ? Math.round(
              (value +
                (next - Number(base[dimension])) * factor -
                (old - Number(base[dimension])) * oldFactor) *
                PRECISION
            ) / PRECISION
          : `(${value}) + ((${next}) - (${base[dimension]})) * ${factor} - ((${old}) - (${base[dimension]})) * ${oldFactor}`;
    });
    return value;
  });
  let resized = setLayout(
    source,
    'objects',
    id,
    ['envelopes', 'keycap', 'size'],
    size
  );
  if (alignment) {
    resized = setLayout(
      resized,
      'objects',
      id,
      ['properties', 'key_alignment'],
      alignment
    );
  }
  return setLayout(resized, 'objects', id, ['placement', 'override', 'at'], at);
}
