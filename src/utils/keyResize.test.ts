import { parse } from 'yaml';
import { resizeKey } from './keyResize';

it('anchors the top edge and preserves manual offsets across repeated resizing', () => {
  const source =
    'schema: ergogen/v1\nparts: {mx: {envelopes: {keycap: {size: [18, 18]}}}}\nlayout: {objects: {a: {kind: key, part: mx, placement: {override: {at: [2, 3, 0]}}}}}\n';
  const enlarged = resizeKey(source, 'a', [18, 27.525]);
  expect(parse(enlarged).layout.objects.a.placement.override.at).toEqual([
    2, -1.7625, 0,
  ]);
  expect(
    parse(resizeKey(enlarged, 'a', [18, 18])).layout.objects.a.placement
      .override.at
  ).toEqual([2, 3, 0]);
});

it('applies width compensation in the rotated key axes', () => {
  const source =
    'schema: ergogen/v1\nlayout: {objects: {a: {kind: key, placement: {rotate: 90}}}}\n';
  expect(
    parse(resizeKey(source, 'a', [28, 18])).layout.objects.a.placement.override
      .at
  ).toEqual([0, 5, 0]);
});

it('keeps the outside left edge aligned while preserving its existing offset', () => {
  const source =
    'schema: ergogen/v1\nlayout: {clusters: {fingers: {arrangement: {type: columns, columns: [c1, c2], rows: [r1, r2]}}}, objects: {a: {kind: key, cluster: fingers, cell: [c1, r1], placement: {override: {at: [2, 3, 0]}}}}}\n';
  const enlarged = resizeKey(source, 'a', [22.7625, 18]);
  expect(parse(enlarged).layout.objects.a.placement.override.at).toEqual([
    4.38125, 3, 0,
  ]);
  expect(
    parse(resizeKey(enlarged, 'a', [18, 18])).layout.objects.a.placement
      .override.at
  ).toEqual([2, 3, 0]);
});

it('keeps the outside right edge fixed and supports centre alignment', () => {
  const source =
    'schema: ergogen/v1\nlayout: {clusters: {fingers: {arrangement: {type: columns, columns: [c1, c2], rows: [r1]}}}, objects: {a: {kind: key, cluster: fingers, cell: [c2, r1]}}}\n';
  const resized = resizeKey(source, 'a', [28, 18]);
  expect(parse(resized).layout.objects.a.placement.override.at).toEqual([
    -5, 0, 0,
  ]);
  const centred = resizeKey(resized, 'a', [28, 18], undefined, {
    x: 'center',
    y: 'top',
  });
  expect(parse(centred).layout.objects.a.placement.override.at).toEqual([
    0, 0, 0,
  ]);
});
