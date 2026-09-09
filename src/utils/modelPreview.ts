import { modelList, modelMatrix } from './modelGeometry';
import { CaseConfig } from '../types/case';
import { STLLoader, STLExporter } from 'three-stdlib';
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { Results } from '../types/results';
import { assetBytes, CaseAssets, findAsset } from './caseAssets';
// Mesh references use the same PCB and assembly transforms as the native geometry.
export function attachModelMeshes(results: Results, assets: CaseAssets) {
  for (const [id, board] of Object.entries(results.designs?.boards || {})) {
    const assembly = results.designs?.assemblies[id];
    if (!assembly) {
      continue;
    }
    const spec = assembly.parameters as CaseConfig;
    for (const component of board.components) {
      const associations = modelList(
        spec.board?.models?.[component.id] ||
          component.models.map((model) => ({
            ...model,
            asset: findAsset(model.path, assets),
          }))
      );
      const key = `${id}_components_board_${id}_${component.id.replace(/[^A-Za-z0-9_]/g, '_')}`;
      if (!results.solids?.[key]) {
        continue;
      }
      const group = new Group();
      for (const association of associations) {
        const info = assets[`__model_${association.asset}.json`];
        if (!info) {
          continue;
        }
        const metadata = JSON.parse(info),
          bytes = assetBytes(metadata.stl);
        const geometry = new STLLoader().parse(bytes.buffer);
        const material = new MeshBasicMaterial();
        try {
          geometry.applyMatrix4(modelMatrix(association));
          if (component.side === 'bottom') {
            geometry.rotateX(Math.PI);
          }
          geometry.rotateZ((component.rotation * Math.PI) / 180);
          geometry.translate(
            component.position[0],
            component.position[1],
            Number(spec.pcb_z) +
              (component.side === 'top' ? board.thickness : 0)
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
          group.add(new Mesh(geometry.clone(), material));
        } finally {
          geometry.dispose();
          material.dispose();
        }
      }
      if (
        group.children.length === associations.length &&
        group.children.length
      ) {
        const data = new STLExporter().parse(group, { binary: true });
        results.solids[key].stl = new Uint8Array(data.buffer);
      }
      group.children.forEach((mesh) => (mesh as Mesh).geometry.dispose());
    }
  }
}

// Transform cached meshes without rerunning case solids or mutating the last valid build.
export function previewModels(
  results: Results,
  name: string,
  models: CaseConfig,
  assets: CaseAssets
) {
  const assembly = results.designs?.assemblies[name];
  if (!assembly) {
    return results;
  }
  const parameters = (assembly.parameters || {}) as CaseConfig;
  const preview = {
    ...results,
    solids: Object.fromEntries(
      Object.entries(results.solids || {}).map(([key, solid]) => [
        key,
        { ...solid },
      ])
    ),
    designs: {
      ...results.designs!,
      assemblies: {
        ...results.designs!.assemblies,
        [name]: {
          ...assembly,
          parameters: {
            ...parameters,
            board: { ...parameters.board, models },
          },
        },
      },
    },
  };
  attachModelMeshes(preview, assets);
  return preview;
}
