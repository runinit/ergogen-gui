import { parse } from 'yaml';
import type { LayoutReport } from 'ergogen/src/native';
import { addCluster, createMatrix } from './studioSource';
import { placeNewItem } from './studioPlacement';
it('starts an added cluster outside existing key envelopes', () => {
  const source = addCluster(
    createMatrix('schema: ergogen/v1\nlayout: {objects: {}}\n', 1, 1),
    'thumbs',
    'arc'
  );
  const report = {
    objects: {
      key: {
        position: [0, 0, 0],
        bounds: {
          keycap: [
            [-9, -9, 0],
            [9, 9, 0],
          ],
        },
      },
    },
    layers: {},
  } as unknown as LayoutReport;
  const result = parse(placeNewItem(source, 'clusters', 'thumbs', report));
  expect(result.layout.clusters.thumbs.placement.at[0]).toBeGreaterThan(9);
  expect(result.layout.clusters.fingers.placement).toBeUndefined();
});
