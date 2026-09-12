import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  assetBytes,
  encodeAsset,
  packageAssets,
  readAssets,
} from './caseAssets';

describe('Portable case assets', () => {
  it('round-trips binary models, associations and board source outside YAML', async () => {
    const bytes = new Uint8Array([0, 1, 128, 255]);
    const assets = {
      'nested/switch.stl': encodeAsset(bytes),
      'nested/switch.wrl': '#VRML V2.0 utf8',
      'board.kicad_pcb': '(kicad_pcb)',
      '__model_nested/switch.stl.json': '{"bounds":[[0,0,0],[1,1,1]]}',
    };
    const zip = new JSZip();
    packageAssets(zip, assets);
    zip.file('config.yaml', 'points: {}');
    const data = await zip.generateAsync({ type: 'uint8array' });
    const loaded = await readAssets({
      name: 'project.zip',
      arrayBuffer: async () => data.buffer,
    } as File);
    expect(loaded.assets).toEqual(assets);
    expect(loaded.config).toBe('points: {}');
    expect(assetBytes(loaded.assets['nested/switch.stl'])).toEqual(bytes);
    expect(zip.file('outputs/pcbs/models/nested/switch.wrl')).not.toBeNull();
  });
  it('rejects a manifest with a missing model', async () => {
    const zip = new JSZip();
    zip.file('case-assets.json', '["missing.step"]');
    const data = await zip.generateAsync({ type: 'uint8array' });
    await expect(
      readAssets({
        name: 'project.zip',
        arrayBuffer: async () => data.buffer,
      } as File)
    ).rejects.toThrow(/missing.step/);
  });
});

it('resolves exact model paths and rejects ambiguous basenames', async () => {
  const { findAsset } = await import('./caseAssets');
  const assets = { 'left/chip.step': 'one', 'right/chip.step': 'two' };
  expect(findAsset('${KIPRJMOD}/models/left/chip.step', assets)).toBe(
    'left/chip.step'
  );
  expect(() => findAsset('${KICAD10_3DMODEL_DIR}/chip.step', assets)).toThrow(
    /ambiguous/i
  );
  expect(findAsset('missing.step', assets)).toBeUndefined();
});

it('places model copies beside boards imported from nested ZIP folders', () => {
  const zip = new JSZip();
  packageAssets(zip, { 'parts/chip.step': 'STEP' }, ['project/board']);
  expect(
    zip.file('outputs/pcbs/project/models/parts/chip.step')
  ).not.toBeNull();
});
