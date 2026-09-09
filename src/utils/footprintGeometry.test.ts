import { expect, it } from 'vitest';
import { graphicPoints, padOutline } from './footprintGeometry';
import type { FootprintInfo } from '../types/footprint';
it('tessellates an arc through its supplied midpoint and uses the actual roundrect ratio', () => {
  const arc = graphicPoints({
    type: 'arc',
    start: [1, 0],
    mid: [0, 1],
    end: [-1, 0],
    center: [],
    points: [],
    layer: 'F.SilkS',
  });
  expect(arc[32][0]).toBeCloseTo(0);
  expect(arc[32][1]).toBeCloseTo(1);
  const pad = padOutline({
    index: 0,
    number: '1',
    type: 'smd',
    at: [0, 0],
    layers: ['F.Cu'],
    mechanical: false,
    size: [4, 2],
    shape: 'roundrect',
    roundrect: 0.25,
  });
  expect(pad[0]).toEqual([2, 0.5]);
  expect(pad[16][1]).toBeCloseTo(1);
});

it('normalizes placed pad rotations and mirrors each board side exactly once', async () => {
  const { footprintView } = await import('./footprintGeometry');
  const front: FootprintInfo = {
    targets: [],
    nets: [],
    models: [],
    diagnostics: [],
    at: [100, 200, 90],
    side: 'F',
    pads: [
      {
        index: 0,
        number: '1',
        type: 'smd',
        shape: 'rect',
        size: [1, 1],
        layers: ['F.Cu'],
        mechanical: false,
        at: [1, 2, 120],
      },
    ],
    graphics: [
      {
        type: 'line',
        layer: 'F.SilkS',
        start: [0, 1],
        end: [2, 3],
        mid: [],
        center: [],
        points: [],
      },
    ],
  };
  const back: FootprintInfo = {
    ...front,
    side: 'B',
    pads: [{ ...front.pads[0], at: [1, -2, 60] }],
    graphics: [{ ...front.graphics[0], start: [0, -1], end: [2, -3] }],
  };
  expect(footprintView(front, 'F')?.pads[0].at).toEqual([1, 2, 30]);
  expect(footprintView(front, 'B')?.pads[0].at).toEqual([1, -2, -30]);
  expect(footprintView(back, 'F')?.pads[0].at).toEqual([1, 2, 30]);
  expect(footprintView(back, 'B')?.pads[0].at).toEqual([1, -2, -30]);
  expect(footprintView(back, 'F')?.graphics[0].end).toEqual([2, 3]);
  expect(front.pads[0].at).toEqual([1, 2, 120]);
});
