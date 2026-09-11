import { parse } from 'yaml';
import type { LayoutReport } from 'ergogen/src/native';
import { process as generate } from 'ergogen';
import { moveTargets, attachObject, snapEdges } from './studioMove';
const source = `schema: ergogen/v1
layout:
  objects:
    key: {kind: key, envelopes: {keycap: {size: [18,18]}}, placement: {at: [0,0,0]}}
    diode: {kind: component, envelopes: {body: {size: [4,2], height: [0,1]}}, placement: {ref: key, at: [0,5,0]}}
    encoder: {kind: component, envelopes: {body: {size: [12,12], height: [0,8]}}, placement: {at: [30,0,0]}}
`;
it('moves a key and its selected owned component once in world axes', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  const after = moveTargets(
    source,
    {
      section: 'objects',
      id: 'diode',
      members: [
        { section: 'objects', id: 'key' },
        { section: 'objects', id: 'diode' },
      ],
    },
    [3, 4, 0],
    report
  );
  const result = (await generate(after)).layout;
  expect(result.objects.key.position).toEqual([3, 4, 0]);
  expect(result.objects.diode.position).toEqual([3, 9, 0]);
});
it('snaps the nearby outside component edge with a 2 mm gap', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  const snap = snapEdges(report, ['encoder'], [-12, 0, 0], 2, 1.5);
  expect(snap?.delta[0]).toBeCloseTo(-13);
  expect(snap?.target).toBe('key');
});
it('attaches with the current offset and follows a later parent move', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  const after = attachObject(source, 'encoder', 'key', [-13, 0, 0], report);
  expect(parse(after).layout.objects.encoder.placement).toMatchObject({
    ref: 'key',
    at: [17, 0, 0],
  });
  const moved = moveTargets(
    after,
    { section: 'objects', id: 'key' },
    [4, 0, 0],
    (await generate(after)).layout
  );
  expect((await generate(moved)).layout.objects.encoder.position).toEqual([
    21, 0, 0,
  ]);
});
it('rejects a placement cycle and locked selection atomically', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  expect(() =>
    attachObject(source, 'key', 'diode', [0, 0, 0], report)
  ).toThrow();
  const locked = source.replace(
    'encoder: {kind:',
    'encoder: {locked: true, kind:'
  );
  expect(() =>
    moveTargets(
      locked,
      {
        section: 'objects',
        id: 'encoder',
        members: [
          { section: 'objects', id: 'key' },
          { section: 'objects', id: 'encoder' },
        ],
      },
      [3, 4, 0],
      report
    )
  ).toThrow(/locked/);
});
it('preserves orientation when attaching to a rotated target', async () => {
  const rotated = source.replace('at: [0,0,0]', 'at: [0,0,0], rotate: 30');
  const report = (await generate(rotated)).layout as LayoutReport;
  const after = (
    await generate(attachObject(rotated, 'encoder', 'key', [-2, 3, 0], report))
  ).layout;
  expect(after.objects.encoder.position[0]).toBeCloseTo(28, 5);
  expect(after.objects.encoder.position[1]).toBeCloseTo(3, 5);
  expect(after.objects.encoder.rotation).toBeCloseTo(0, 5);
});
it('does not snap across different physical boards or distant edges', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  report.objects.key.pcb = 'other';
  expect(snapEdges(report, ['encoder'], [-12, 0, 0], 2, 1.5)).toBeUndefined();
  expect(snapEdges(report, ['encoder'], [100, 100, 0], 2, 1.5)).toBeUndefined();
});
it('snaps rotated edges rather than an axis-aligned bounding box', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  const radians = Math.PI / 6,
    c = Math.cos(radians),
    s = Math.sin(radians);
  for (const item of Object.values(report.objects)) {
    const [x, y, z] = item.position;
    item.position = [x * c - y * s, x * s + y * c, z];
    item.matrix = [
      c,
      -s,
      0,
      item.position[0],
      s,
      c,
      0,
      item.position[1],
      0,
      0,
      1,
      z,
      0,
      0,
      0,
      1,
    ];
  }
  const snap = snapEdges(report, ['encoder'], [-12 * c, -12 * s, 0], 2, 1.5);
  expect(snap?.delta[0]).toBeCloseTo(-13 * c, 5);
  expect(snap?.delta[1]).toBeCloseTo(-13 * s, 5);
});
it('refuses a flush-edge snap that would crowd another neighbour', async () => {
  const report = (await generate(source)).layout as LayoutReport;
  expect(snapEdges(report, ['encoder'], [-15, 9, 0], 2, 1.5)).toBeUndefined();
});
