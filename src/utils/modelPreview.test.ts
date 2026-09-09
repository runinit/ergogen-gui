import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { STLExporter, STLLoader } from 'three-stdlib';
import { encodeAsset } from './caseAssets';
import { previewModels } from './modelPreview';
import type { Results } from '../types/results';
describe('Immediate model alignment', () => {
  it.each(['top', 'bottom'])(
    'aligns %s models in assembly coordinates without changing the saved build',
    (side) => {
      const geometry = new BoxGeometry(1, 1, 1);
      geometry.translate(0.5, 0.5, 0.5);
      const material = new MeshBasicMaterial();
      const data = new STLExporter().parse(new Mesh(geometry, material), {
        binary: true,
      });
      const assets = {
        '__model_chip.step.json': JSON.stringify({
          stl: encodeAsset(new Uint8Array(data.buffer)),
        }),
      };
      const key = 'case_components_board_case_U1';
      const results = {
        solids: { [key]: { stl: 'previous' } },
        designs: {
          boards: {
            case: {
              thickness: 1.6,
              components: [
                {
                  id: 'U1',
                  side,
                  rotation: 90,
                  position: [10, 20],
                  models: [],
                },
              ],
            },
          },
          assemblies: {
            case: {
              parts: {},
              parameters: { pcb_z: 6, board: {} },
              placement: { origin: [0, 0, 0], angle: 0, lift: 0 },
            },
          },
        },
      } as unknown as Results;
      const transformed = previewModels(
        results,
        'case',
        {
          U1: [
            {
              path: 'chip.step',
              asset: 'chip.step',
              offset: [1, 2, 3],
              rotate: [0, 0, 0],
              scale: [1, 1, 1],
            },
          ],
        },
        assets
      );
      const mesh = new STLLoader().parse(
        (transformed.solids![key].stl as Uint8Array).buffer as ArrayBuffer
      );
      mesh.computeBoundingBox();
      expect(mesh.boundingBox!.min.x).toBeCloseTo(side === 'top' ? 7 : 12);
      expect(mesh.boundingBox!.min.y).toBeCloseTo(21);
      expect(mesh.boundingBox!.min.z).toBeCloseTo(side === 'top' ? 10.6 : 2);
      expect(results.solids![key].stl).toBe('previous');
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    }
  );
});
