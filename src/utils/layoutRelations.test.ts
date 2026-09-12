import { resolve } from 'ergogen/src/native/layout';
import { parse, stringify } from 'yaml';
import { unlinkRelation } from './layoutRelations';

it('releases a distance relationship without snapping its follower back', () => {
  const source = stringify({
    schema: 'ergogen/v1',
    layout: {
      objects: {
        a: { kind: 'component' },
        b: {
          kind: 'component',
          placement: { at: [10, 0, 0], solve: ['x', 'y'] },
        },
      },
      constraints: {
        distance: {
          type: 'distance',
          refs: ['a.center', 'b.center'],
          value: 20,
        },
      },
    },
    meta: {
      studio: {
        relations: {
          distance: { owners: [{ object: 'b', added: ['x', 'y'] }] },
        },
      },
    },
  });
  const report = resolve(parse(source));
  report.objects.b.position = [20, 0, 0];
  const next = unlinkRelation(source, 'distance', report);
  expect(resolve(parse(next)).objects.b.position[0]).toBe(20);
  expect(parse(next).layout.objects.b.placement.solve).toEqual([]);
});
