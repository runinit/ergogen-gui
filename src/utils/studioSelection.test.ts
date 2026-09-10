import { parse } from 'yaml';
import { adjustSelection, sizeSelection } from './studioSelection';
const source =
  'schema: ergogen/v1\nlayout: {clusters: {fingers: {arrangement: {type: columns, columns: [c1,c2], rows: [r1,r2], splay: {c1: 5}, offsets: {c1: [2,3,0]}, stagger: {c1: 4}}}}, objects: {a: {kind: key, cluster: fingers, cell: [c1,r1]}, b: {kind: key, cluster: fingers, cell: [c1,r2]}, c: {kind: key, cluster: fingers, cell: [c2,r1]}}}\n';
it('adjusts a column relative to its existing splay, stagger and offsets', () => {
  const result = parse(
    adjustSelection(
      source,
      { section: 'columns', cluster: 'fingers', id: 'c1' },
      [2, -1, 0],
      10,
      3
    )
  );
  expect(result.layout.clusters.fingers.arrangement).toMatchObject({
    offsets: { c1: [4, 2, 0] },
    splay: { c1: 15 },
    stagger: { c1: 7 },
  });
});
it('resizes only selected column members', () => {
  const result = parse(
    sizeSelection(
      source,
      { section: 'columns', cluster: 'fingers', id: 'c1' },
      [22, 18],
      { x: 'left' }
    )
  );
  expect(result.layout.objects.a.envelopes.keycap.size).toEqual([22, 18]);
  expect(result.layout.objects.b.envelopes.keycap.size).toEqual([22, 18]);
  expect(result.layout.objects.c.envelopes).toBeUndefined();
});
it('keeps a batch edit atomic when a member is locked', () => {
  const locked = source.replace('b: {kind: key', 'b: {locked: true, kind: key');
  expect(() =>
    sizeSelection(
      locked,
      { section: 'columns', cluster: 'fingers', id: 'c1' },
      [22, 18]
    )
  ).toThrow(/locked/);
});
