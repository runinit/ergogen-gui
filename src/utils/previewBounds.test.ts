import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { previewBounds } from './previewBounds';

it('frames the placed footprint without including transform gizmos', () => {
  const scene = new Group();
  const placement = new Group();
  placement.position.set(3, 4, 5);
  const model = new Mesh(new BoxGeometry(2, 4, 6));
  model.userData.footprint = true;
  placement.add(model);
  scene.add(placement, new Mesh(new BoxGeometry(1e6, 1e6, 1e6)));
  const bounds = previewBounds(scene);
  expect(bounds.getSize(new Vector3()).toArray()).toEqual([2, 4, 6]);
  expect(bounds.getCenter(new Vector3()).toArray()).toEqual([3, 4, 5]);
});
