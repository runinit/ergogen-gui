import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { exportConfigsProgressively } from './zip';
vi.stubGlobal('indexedDB', {});
const cached = vi.hoisted(() => ({
  'hash/chip.step': 'STEP',
  '__model_hash/chip.step.json': '{"bounds":[[0,0,0],[1,1,1]]}',
}));
const requests = vi.hoisted(() => [] as Record<string, any>[]);
vi.mock('./caseAssets', async (original) => ({
  ...(await original<typeof import('./caseAssets')>()),
  loadAssets: async () => cached,
}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../workers/workerFactory', () => ({
  createErgogenWorker: () => ({
    onmessage: null as any,
    terminate: vi.fn(),
    postMessage(request: Record<string, any>) {
      requests.push(request);
      queueMicrotask(() =>
        this.onmessage?.({
          data: {
            type: 'success',
            requestId: request.requestId,
            results: { pcbs: { board: 'PCB' } },
          },
        })
      );
    },
  }),
  createJscadWorker: () => null,
}));
async function archive() {
  const blob = vi.mocked(saveAs).mock.lastCall![0] as Blob;
  const bytes = await new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
  return JSZip.loadAsync(bytes);
}
describe('Portable bulk export', () => {
  it('compiles with cached assets and packages them beside exported boards', async () => {
    await exportConfigsProgressively(
      [{ name: 'one', config: 'points: {}' }],
      undefined,
      false,
      false,
      false,
      vi.fn(),
      () => false
    );
    expect(requests[0].options?.assets).toEqual(cached);
    const zip = await archive();
    expect(
      await zip.file('one/outputs/pcbs/models/hash/chip.step')?.async('string')
    ).toBe('STEP');
    expect(zip.file('one/case-assets.json')).not.toBeNull();
  });
  it('includes assets when exporting project sources for offline reopening', async () => {
    await exportConfigsProgressively(
      [{ name: 'one', config: 'points: {}' }],
      undefined,
      false,
      false,
      true,
      vi.fn(),
      () => false
    );
    expect((await archive()).file('case-assets.json')).not.toBeNull();
  });
});
