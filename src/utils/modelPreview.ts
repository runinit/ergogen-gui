import { CaseConfig } from '../types/case';
import { STLLoader, STLExporter } from 'three-stdlib';
import {
  Euler,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { Results } from '../types/results';
import { assetBytes, CaseAssets } from './caseAssets';
// Mesh references use the same PCB and assembly transforms as the native geometry.
export function attachModelMeshes(results: Results, assets: CaseAssets) {
  for (const [id, board] of Object.entries(results.designs?.boards || {})) {
    const assembly = results.designs?.assemblies[id];
    if (!assembly) {
      continue;
    }
    const spec = assembly.parameters as CaseConfig;
    for (const component of board.components) {
      const association = spec.board?.models?.[component.id];
      const info = assets[`__model_${association?.asset}.json`];
      if (!info) {
        continue;
      }
      const key = `${id}_components_board_${id}_${component.id.replace(/[^A-Za-z0-9_]/g, '_')}`;
      if (!results.solids?.[key]) {
        continue;
      }
      const metadata = JSON.parse(info),
        bytes = assetBytes(metadata.stl);
      const geometry = new STLLoader().parse(bytes.buffer);
      const material = new MeshBasicMaterial();
      try {
        const matrix = new Matrix4().compose(
          new Vector3(...association.offset),
          new Quaternion().setFromEuler(
            new Euler(
              ...(association.rotate.map(
                (v: number) => (-v * Math.PI) / 180
              ) as [number, number, number]),
              'ZYX'
            )
          ),
          new Vector3(...association.scale)
        );
        geometry.applyMatrix4(matrix);
        if (component.side === 'bottom') {
          geometry.rotateX(Math.PI);
        }
        geometry.rotateZ((component.rotation * Math.PI) / 180);
        geometry.translate(
          component.position[0],
          component.position[1],
          Number(spec.pcb_z) + (component.side === 'top' ? board.thickness : 0)
        );
        const placement = assembly.placement!;
        geometry.translate(
          -placement.origin[0],
          -placement.origin[1],
          -placement.origin[2]
        );
        geometry.rotateX((placement.angle * Math.PI) / 180);
        geometry.translate(
          placement.origin[0],
          placement.origin[1],
          placement.origin[2] + placement.lift
        );
        const data = new STLExporter().parse(new Mesh(geometry, material), {
          binary: true,
        });
        results.solids[key].stl = new Uint8Array(data.buffer);
      } finally {
        geometry.dispose();
        material.dispose();
      }
    }
  }
}
