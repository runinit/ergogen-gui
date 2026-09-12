import { parse } from 'yaml';
import { resolve } from 'ergogen/src/native/layout';
import { dimension, pitchUnits, ensurePitchUnits } from './designUnits';
import { moveColumn } from './studioSource';

const source = `schema: ergogen/v1
units: {u: 19, v: 17}
layout:
  clusters:
    fingers:
      arrangement: {type: columns, columns: [c1], rows: [r1], pitch: [u,v], stagger: {c1: 0.25u}, offsets: {c1: [0,2,0]}}
  objects:
    key: {kind: key, cluster: fingers, cell: [c1,r1]}
`;
it('resolves authored units and rejects invalid dimensions', () => {
  const units = pitchUnits(source);
  expect(dimension('0.25u', units)).toBe(4.75);
  expect(dimension('0.5v', units)).toBe(8.5);
  expect(() => dimension('missing / 2', units)).toThrow();
  expect(() => dimension('', units)).toThrow();
});
it('fills missing pitch units without replacing authored units', () => {
  expect(ensurePitchUnits(source)).toBe(source);
  const blank = 'schema: ergogen/v1\nlayout: {}\n';
  expect(parse(ensurePitchUnits(blank)).units).toEqual({ u: 19, v: 'u' });
});
it('moves a column vertically through stagger while preserving its offset', () => {
  const report = resolve(parse(source));
  const next = moveColumn(
    source,
    'fingers',
    'c1',
    [0, 4.75, 0],
    report.clusters.fingers.matrix
  );
  const arrangement = parse(next).layout.clusters.fingers.arrangement;
  expect(arrangement.offsets.c1).toEqual([0, 2, 0]);
  expect(dimension(arrangement.stagger.c1, pitchUnits(next))).toBe(9.5);
  expect(resolve(parse(next)).objects.key.position[1]).toBe(11.5);
});
