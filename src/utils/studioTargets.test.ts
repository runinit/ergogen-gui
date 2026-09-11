import { selectTargets, targets, movingTargets } from './studioTargets';

const a = { section: 'objects' as const, id: 'a' };
const b = { section: 'objects' as const, id: 'b' };
const c = { section: 'objects' as const, id: 'c' };
it('toggles objects and extends ranges from the original anchor', () => {
  const selection = selectTargets(a, c, 'toggle', [a, b, c]);
  expect(targets(selection)).toEqual([a, c]);
  expect(targets(selectTargets(selection, b, 'range', [a, b, c]))).toEqual([
    a,
    b,
  ]);
  expect(targets(selectTargets(selection, a, 'toggle', [a, b, c]))).toEqual([
    c,
  ]);
});
it('moves a referenced component only once with its selected parent', () => {
  const source =
    'schema: ergogen/v1\nlayout: {objects: {a: {kind: key}, b: {kind: component, placement: {ref: a}}}}';
  expect(movingTargets(source, { ...b, members: [a, b] })).toEqual([a]);
});
it('does not move a selected column twice with its cluster', () => {
  const cluster = { section: 'clusters' as const, id: 'fingers' };
  const column = { section: 'columns' as const, cluster: 'fingers', id: 'c1' };
  const source =
    'schema: ergogen/v1\nlayout: {clusters: {fingers: {}}, objects: {a: {kind: key, cluster: fingers, cell: [c1,r1]}}}';
  expect(
    movingTargets(source, { ...a, members: [cluster, column, a] })
  ).toEqual([cluster]);
});
it('moves a virtual mirrored key once with its selected matrix', () => {
  const source =
    'schema: ergogen/v1\nlayout: {clusters: {left: {}, right: {mirror: {source: left}}}, objects: {a: {kind: key, cluster: left, cell: [c1,r1]}}}';
  const matrix = { section: 'clusters' as const, id: 'right' };
  const key = { section: 'objects' as const, id: 'right__a' };
  expect(movingTargets(source, { ...key, members: [matrix, key] })).toEqual([
    matrix,
  ]);
});
