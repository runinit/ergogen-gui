import { Box3, Object3D, Vector3 } from 'three';

// Frame geometry only: transform-control pickers extend far beyond the model.
export function previewBounds(scene: Object3D): Box3 {
  scene.updateMatrixWorld(true);
  const bounds = new Box3();
  scene.traverse((object) => {
    if (object.userData.footprint) {
      bounds.expandByObject(object);
    }
  });
  if (bounds.isEmpty()) {
    bounds.setFromCenterAndSize(new Vector3(), new Vector3(10, 10, 10));
  }
  return bounds;
}
