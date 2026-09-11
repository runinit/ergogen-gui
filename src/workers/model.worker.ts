import { STLLoader, VRMLLoader, STLExporter } from 'three-stdlib';
import { BufferGeometry, Mesh, MeshBasicMaterial, Group } from 'three';
import { assetBytes, encodeAsset } from '../utils/caseAssets';
import { kiCadVrml } from '../utils/modelExport';
import cadWasm from 'replicad-opencascadejs/wasm?url';

// Model import is explicit work; ordinary draft analysis never initializes native CAD.
self.onmessage = async ({
  data,
}: {
  data: { name: string; source: string };
}) => {
  const geometries: BufferGeometry[] = [];
  try {
    let bytes = assetBytes(data.source);
    if (/\.(step|stp)$/i.test(data.name)) {
      const r = await import('replicad'),
        { default: load } = await import('replicad-opencascadejs');
      r.setOC(await load({ locateFile: () => cadWasm }));
      const shape = await r.importSTEP(new Blob([bytes]));
      try {
        bytes = new Uint8Array(
          await shape.blobSTL({ binary: true }).arrayBuffer()
        );
      } finally {
        shape.delete();
      }
    }
    const scene = new Group();
    if (/\.(wrl|vrml)$/i.test(data.name)) {
      const imported = new VRMLLoader().parse(
        new TextDecoder().decode(bytes),
        ''
      );
      imported.updateMatrixWorld(true);
      imported.traverse((object) => {
        if (object instanceof Mesh) {
          const geometry = object.geometry
            .clone()
            .applyMatrix4(object.matrixWorld);
          geometry.scale(2.54, 2.54, 2.54);
          geometries.push(geometry);
        }
      });
      imported.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    } else {
      geometries.push(
        new STLLoader().parse(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          )
        )
      );
    }
    const positions: number[] = [];
    for (const input of geometries) {
      const geometry = input.index ? input.toNonIndexed() : input;
      const attr = geometry.getAttribute('position');
      for (let i = 0; i < attr.count; i++) {
        positions.push(attr.getX(i), attr.getY(i), attr.getZ(i));
      }
      if (geometry !== input) {
        geometry.dispose();
      }
      scene.add(new Mesh(input, new MeshBasicMaterial()));
    }
    if (
      !positions.length ||
      positions.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('The model contains no usable triangles.');
    }
    const low = [Infinity, Infinity, Infinity],
      high = [-Infinity, -Infinity, -Infinity];
    positions.forEach((value, i) => {
      low[i % 3] = Math.min(low[i % 3], value);
      high[i % 3] = Math.max(high[i % 3], value);
    });
    const stl = new STLExporter().parse(scene, { binary: true });
    self.postMessage({
      bounds: [low, high],
      stl: encodeAsset(new Uint8Array(stl.buffer)),
      vrml: kiCadVrml(positions),
    });
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        (object.material as MeshBasicMaterial).dispose();
      }
    });
  } catch (error) {
    self.postMessage({ error: String(error) });
  } finally {
    geometries.forEach((geometry) => geometry.dispose());
  }
};
