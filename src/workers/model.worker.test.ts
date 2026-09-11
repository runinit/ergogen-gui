import { afterEach, expect, it, vi } from 'vitest';
import { assetBytes } from '../utils/caseAssets';
import { STLLoader } from 'three-stdlib';
afterEach(() => vi.unstubAllGlobals());
it('converts KiCad VRML into visible millimetre triangles', async () => {
  const scope = {
    postMessage: vi.fn(),
    onmessage: null as null | ((event: unknown) => Promise<void>),
  };
  vi.stubGlobal('self', scope);
  await import('./model.worker');
  await scope.onmessage!({
    data: {
      name: 'test.wrl',
      source:
        '#VRML V2.0 utf8\nTransform { translation 1 2 3 children [ Shape { geometry Box { size 2 4 6 } } ] }',
    },
  });
  const result = scope.postMessage.mock.calls[0][0];
  expect(result.error).toBeUndefined();
  expect(result.bounds[1][2]).toBeCloseTo(15.24);
  const geometry = new STLLoader().parse(
    assetBytes(result.stl).buffer as ArrayBuffer
  );
  expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
  geometry.dispose();
});
