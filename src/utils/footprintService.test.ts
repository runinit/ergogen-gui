import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import {
  prepareFootprint,
  prepareModel,
  readFootprintFiles,
} from './footprintService';
import { createEntry } from './footprintLibrary';
const workers: WorkerDouble[] = [];
class WorkerDouble {
  onmessage?: (event: { data: Record<string, unknown> }) => void;
  onerror?: (event: { message: string }) => void;
  terminate = vi.fn();
  payload: Record<string, unknown> = {};
  constructor() {
    workers.push(this);
  }
  postMessage(payload: Record<string, unknown>) {
    this.payload = payload;
  }
  reply(data: Record<string, unknown>) {
    this.onmessage?.({ data: { requestId: this.payload.requestId, ...data } });
  }
}
beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal('Worker', WorkerDouble);
});
afterEach(() => vi.unstubAllGlobals());
describe('Footprint import workers', () => {
  it('cancels ownership and ignores a response for an obsolete request', async () => {
    const controller = new AbortController();
    const pending = prepareFootprint(
      createEntry('test', 'source', 'kicad'),
      controller.signal
    );
    const rejected = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    workers[0].reply({ result: { module: 'obsolete' } });
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalled();
  });
  it('keeps original STL bytes and gives different content with the same name distinct portable identities', async () => {
    const model = async (source: string) => {
      const result = prepareModel(
        'chip.stl',
        source,
        new AbortController().signal
      );
      await vi.waitFor(() =>
        expect(workers.at(-1)?.payload.source).toBe(source)
      );
      workers.at(-1)!.reply({
        bounds: [
          [0, 0, 0],
          [1, 1, 1],
        ],
        stl: 'mesh',
        vrml: '#VRML',
      });
      return result;
    };
    const one = await model('one'),
      two = await model('two');
    expect(one.model.asset).not.toBe(two.model.asset);
    expect(one.assets[one.model.asset!]).toBe('one');
    expect(one.model.path).toMatch(/\$\{KIPRJMOD\}\/models\/.*\/chip.wrl$/);
    expect(
      Object.keys(one.assets).some((path) => path.endsWith('chip.wrl'))
    ).toBe(true);
  });
  it('accepts .pretty folders and ZIP batches including bundled models', async () => {
    const zip = new JSZip();
    zip.file('parts.pretty/one.kicad_mod', '(footprint "one")');
    zip.file('models/chip.step', 'STEP');
    const files = await readFootprintFiles(
      [
        {
          name: 'bundle.zip',
          size: 100,
          arrayBuffer: async () => zip.generateAsync({ type: 'arraybuffer' }),
        } as File,
        {
          name: 'two.kicad_mod',
          webkitRelativePath: 'parts.pretty/two.kicad_mod',
          size: 10,
          text: async () => '(footprint "two")',
        } as File,
      ],
      new AbortController().signal
    );
    expect(files.map((file) => file.kind)).toEqual(['kicad', 'model', 'kicad']);
    expect(files[2].name).toBe('parts.pretty/two.kicad_mod');
  });
});

it('bounds a multi-file import as well as expanded ZIP contents', async () => {
  const files = ['one.step', 'two.step'].map(
    (name) =>
      ({ name, size: 30 * 1024 * 1024, text: async () => 'STEP' }) as File
  );
  await expect(
    readFootprintFiles(files, new AbortController().signal)
  ).rejects.toThrow(/50 MB/);
});
