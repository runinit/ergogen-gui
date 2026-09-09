import { describe, expect, it } from 'vitest';
import { modelEnvelope, modelMatrix } from './modelGeometry';
import { Vector3 } from 'three';
import type { ModelBinding } from '../types/footprint';

const model: ModelBinding = {
  path: 'part.step',
  asset: 'part.step',
  offset: [3, 4, 5],
  scale: [2, 1, 1],
  rotate: [0, 0, 90],
};
describe('Aligned model geometry', () => {
  it('applies KiCad scale, negative ZYX rotation, then offset', () => {
    const point = new Vector3(1, 0, 0).applyMatrix4(modelMatrix(model));
    expect(point.x).toBeCloseTo(3);
    expect(point.y).toBeCloseTo(2);
    expect(point.z).toBeCloseTo(5);
  });
  it('unions every model and keeps missing model dimensions unchecked', () => {
    const assets = {
      '__model_part.step.json': JSON.stringify({
        bounds: [
          [0, 0, 0],
          [2, 1, 3],
        ],
      }),
    };
    const envelope = modelEnvelope(
      [model, { ...model, offset: [10, 4, 5] }],
      assets
    );
    expect(envelope?.size[0]).toBeCloseTo(8);
    expect(envelope?.size[1]).toBeCloseTo(4);
    expect(envelope?.height).toEqual([5, 8]);
    expect(
      modelEnvelope([model, { ...model, asset: 'missing' }], assets)
    ).toBeNull();
  });
});
