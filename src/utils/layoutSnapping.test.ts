import { snapLayout, defaultSnapping } from './layoutSnapping';
import { resolve } from 'ergogen/src/native/layout';
import { parse } from 'yaml';
const source = `schema: ergogen/v1
units: {u: 19, v: 17}
layout:
  objects:
    a: {kind: key, placement: {at: [0,0,0]}}
    b: {kind: component, placement: {at: [25,25,0]}}
`;
it('snaps movement to independent quarter-pitch increments', () => {
  const report = resolve(parse(source));
  const result = snapLayout(
    report,
    ['b'],
    [1, 1, 0],
    { ...defaultSnapping, centers: false, edges: false },
    { u: 19, v: 17 },
    1,
    {}
  );
  expect(result.delta).toEqual([-1.25, 0.5, 0]);
});
it('prefers center guides over the grid and excludes moving members', () => {
  const report = resolve(parse(source));
  const matrix = report.objects.a.matrix;
  report.guides = {
    'a.center': {
      id: 'a.center',
      label: 'Key A',
      position: [0, 0, 0],
      matrix,
      axes: ['x', 'y'],
      members: ['a'],
    },
    'b.center': {
      id: 'b.center',
      label: 'Part B',
      position: [25, 25, 0],
      matrix: report.objects.b.matrix,
      axes: ['x', 'y'],
      members: ['b'],
    },
  };
  const result = snapLayout(
    report,
    ['b'],
    [-24.5, 5, 0],
    defaultSnapping,
    { u: 19, v: 17 },
    1,
    {}
  );
  expect(result.delta[0]).toBe(-25);
  expect(result.target).toBe('a.center');
  expect(result.axis).toBe('y');
});
