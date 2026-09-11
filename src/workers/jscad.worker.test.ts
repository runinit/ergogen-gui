import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../public/dependencies/openjscad.js', () => ({
  default: undefined,
  convert: undefined,
}));
afterEach(() => vi.unstubAllGlobals());

it('rejects a design batch when any part cannot be converted', async () => {
  const scope = {
    JscadConvert: {
      convert: () => {
        throw new Error('Invalid mesh');
      },
    },
    postMessage: vi.fn(),
    onmessage: null as null | ((event: unknown) => Promise<void>),
  };
  vi.stubGlobal('self', scope);
  await import('./jscad.worker');
  await scope.onmessage!({
    data: {
      type: 'batch_jscad_to_stl',
      configVersion: 7,
      results: { designs: {}, cases: { tray: { jscad: 'broken' } } },
    },
  });
  expect(scope.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'error',
      configVersion: 7,
      error: expect.stringContaining('Invalid mesh'),
    })
  );
  expect(scope.postMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success' })
  );
});

it('loads the converter from production module exports', async () => {
  vi.resetModules();
  const convert = vi.fn(() => ({
    data: [new ArrayBuffer(84)],
    mimeType: 'application/sla',
  }));
  vi.doMock('../../public/dependencies/openjscad.js', () => ({
    default: { convert },
  }));
  const scope = {
    postMessage: vi.fn(),
    onmessage: null as null | ((event: unknown) => Promise<void>),
  };
  vi.stubGlobal('self', scope);
  await import('./jscad.worker');
  await scope.onmessage!({
    data: {
      type: 'batch_jscad_to_stl',
      configVersion: 8,
      results: { designs: {}, cases: { tray: { jscad: 'valid' } } },
    },
  });
  expect(convert).toHaveBeenCalled();
  expect(scope.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success', configVersion: 8 })
  );
});
