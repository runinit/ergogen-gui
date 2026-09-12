import { process as generate } from 'ergogen';
import { layoutSpacing, hasSpacing } from './snapSpacing';
import { snapEdges } from './studioMove';
import type { LayoutReport } from 'ergogen/src/native';
const source = `schema: ergogen/v1
units: {pitch: 19.05}
parts: {mx: {revision: "1", envelopes: {keycap: {size: [18,18]}}}}
layout:
  clusters: {main: {arrangement: {type: columns, columns: [c1,c2], rows: [r1], pitch: [pitch,pitch]}}}
  objects:
    a: {kind: key, part: mx, cluster: main, cell: [c1,r1]}
    b: {kind: key, part: mx, cluster: main, cell: [c2,r1]}
`;
it('uses the layout key gap regardless of component gap', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  const spacing = layoutSpacing(source, report);
  expect(spacing.a![0]).toBeCloseTo(1.05);
  const snap = snapEdges(report, ['b'], [-0.4, 0, 0], 4, 1, spacing);
  expect(snap?.delta[0]).toBeCloseTo(0);
  expect(hasSpacing(report, ['b'], [-0.4, 0, 0], 4, spacing)).toBe(false);
});
it('keeps the same gap for an oversized key', async () => {
  const wider = source.replace(
    'kind: key, part: mx, cluster: main, cell: [c2,r1]',
    'kind: key, part: mx, cluster: main, cell: [c2,r1], envelopes: {keycap: {size: [27.525,18]}}, placement: {override: {at: [4.7625,0,0]}}'
  );
  const report = (await generate(wider)).layout as LayoutReport;
  expect(
    hasSpacing(report, ['b'], [0, 0, 0], 2, layoutSpacing(wider, report))
  ).toBe(true);
  expect(
    hasSpacing(report, ['b'], [-0.5, 0, 0], 2, layoutSpacing(wider, report))
  ).toBe(false);
});
it('enforces row spacing when row and column pitches differ', async () => {
  const taller = source
    .replace(
      'columns: [c1,c2], rows: [r1], pitch: [pitch,pitch]',
      'columns: [c1], rows: [r1,r2], pitch: [pitch,22]'
    )
    .replace('cell: [c2,r1]', 'cell: [c1,r2]');
  const report = (await generate(taller)).layout as LayoutReport;
  expect(
    hasSpacing(report, ['b'], [0, -0.5, 0], 2, layoutSpacing(taller, report))
  ).toBe(false);
});
it('resolves pitch expressions using the native units', async () => {
  const formula = source.replace(
    'pitch: [pitch,pitch]',
    'pitch: [pitch + 1,pitch]'
  );
  const report = (await generate(formula)).layout as LayoutReport;
  expect(layoutSpacing(formula, report).a?.[0]).toBeCloseTo(2.05);
});
it('does not impose key spacing on component moves', async () => {
  const input = `schema: ergogen/v1
layout:
  objects:
    key: {kind: key, envelopes: {keycap: {size: [18,18]}, body: {size: [14,14], height: [0,11.6]}}}
    battery: {kind: component, envelopes: {pcb: {size: [8,8]}, body: {size: [8,8], height: [0,6]}}, placement: {at: [11.5,0,0]}}
`;
  const report = (await generate(input)).layout as LayoutReport;
  expect(hasSpacing(report, ['battery'], [0, 0, 0], 2, {})).toBe(true);
});
