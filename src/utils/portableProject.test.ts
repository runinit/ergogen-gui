import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { packageAssets, encodeAsset, saveAssets } from './caseAssets';
import { parseZipArchive } from './ergogenBundleLoader';
vi.mock('./caseAssets', async (original) => ({
  ...(await original<typeof import('./caseAssets')>()),
  saveAssets: vi.fn(),
  loadAssets: vi.fn(async () => ({})),
}));
describe('Opening a portable project', () => {
  it('restores model bytes and cached meshes through the normal ZIP importer', async () => {
    const assets = {
      'hash/chip.step': 'ISO-10303-21;',
      'hash/chip.stl': encodeAsset(new Uint8Array([0, 128, 255])),
      '__model_hash/chip.step.json': '{"bounds":[[0,0,0],[1,2,3]]}',
    };
    const zip = new JSZip();
    zip.file('config.yaml', 'points: {}');
    packageAssets(zip, assets);
    const bytes = await zip.generateAsync({ type: 'arraybuffer' });
    expect((await parseZipArchive(bytes)).config).toBe('points: {}');
    expect(saveAssets).toHaveBeenCalledWith(assets);
    expect(zip.file('models/hash/chip.step')).not.toBeNull();
  });
});
