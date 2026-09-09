import { describe, expect, it, vi } from 'vitest';
import { modelUrl, fetchModel, identifyAsset } from './modelSources';

describe('Model sources', () => {
  it('uses the public GitLab file API for official KiCad references', () => {
    const url = modelUrl(
      '${KICAD10_3DMODEL_DIR}/Capacitor_SMD.3dshapes/C_0603.step'
    );
    expect(url).toBe(
      'https://gitlab.com/api/v4/projects/kicad%2Flibraries%2Fkicad-packages3D/repository/files/Capacitor_SMD.3dshapes%2FC_0603.step/raw?ref=master'
    );
  });
  it('normalizes GitHub and GitLab file links', () => {
    expect(modelUrl('https://github.com/acme/parts/blob/main/a%20b.step')).toBe(
      'https://raw.githubusercontent.com/acme/parts/main/a%20b.step'
    );
    expect(
      modelUrl('https://gitlab.com/acme/parts/-/blob/v1/models/part.stp')
    ).toBe(
      'https://gitlab.com/api/v4/projects/acme%2Fparts/repository/files/models%2Fpart.stp/raw?ref=v1'
    );
  });
  it('gives distinct asset identities to equal filenames with different contents', async () => {
    const first = await identifyAsset('part.step', 'one');
    const second = await identifyAsset('part.step', 'two');
    expect(first.path).not.toBe(second.path);
    expect((await identifyAsset('part.step', 'one')).path).toBe(first.path);
  });
  it('reports rate limiting and browser failures with retry and upload actions', async () => {
    await expect(
      fetchModel(
        'https://example.com/a.step',
        new AbortController().signal,
        vi.fn().mockResolvedValue(new Response('', { status: 429 }))
      )
    ).rejects.toThrow(/rate limit.*retry.*upload/i);
    await expect(
      fetchModel(
        'https://example.com/a.step',
        new AbortController().signal,
        vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      )
    ).rejects.toThrow(/browser.*retry.*upload/i);
  });
  it('honours cancellation and refuses an HTML response disguised as a model', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchModel('https://example.com/a.step', controller.signal)
    ).rejects.toThrow(/abort/i);
    await expect(
      fetchModel(
        'https://example.com/a.step',
        new AbortController().signal,
        vi.fn().mockResolvedValue(new Response('<html>login</html>'))
      )
    ).rejects.toThrow(/model/i);
  });
});

it('accepts a pasted GitLab file API URL and keeps its model filename', async () => {
  const url = modelUrl(
    '${KICAD10_3DMODEL_DIR}/Capacitor_SMD.3dshapes/C_0603.step'
  );
  const result = await fetchModel(
    url,
    new AbortController().signal,
    vi.fn().mockResolvedValue(new Response('ISO-10303-21;'))
  );
  expect(result.name).toBe('C_0603.step');
});
