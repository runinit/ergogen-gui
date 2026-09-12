import type { LayoutReport } from 'ergogen/src/native';
import { getValue, readStudio, setValue } from './studioSource';
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
          ? 'left'
          : columns.length > 1 && item?.cell?.[0] === columns[0]
            ? 'right'
            : columns.length > 1
              ? 'center'
              : 'left'
        : value.x;
    return [
      { left: 0.5, center: 0, right: -0.5 }[horizontal],
      { top: -0.5, center: 0, bottom: 0.5 }[value.y],
    ];
  };
  const path = ['layout', 'objects', id, 'placement', 'override', 'at'];
  const present = (getValue(source, path) || [0, 0, 0]) as Dimension[];
  const owned = getValue(source, ['meta', 'studio', 'resizeAnchors', id]) as
    | {
        before: Dimension[];
        after: Dimension[];
        size: Dimension[];
        alignment: KeyAlignment;
      }
    | undefined;
  const reusable =
    owned && JSON.stringify(owned.after) === JSON.stringify(present);
  const beforeFactors = factors(reusable ? owned.alignment : prior),
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
  const previous = reusable ? owned.size : (old as Dimension[]);
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
  const current = reusable ? owned.before : present;
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
  resized = setLayout(
    resized,
    'objects',
    id,
    ['placement', 'override', 'at'],
    at
  );
  return setValue(resized, ['meta', 'studio', 'resizeAnchors', id], {
    before: current,
    after: at,
    size: previous,
    alignment: reusable ? owned.alignment : prior,
  });
}
