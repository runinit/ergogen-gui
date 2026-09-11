import JSZip from 'jszip';
import type {
  FootprintInfo,
  FootprintTarget,
  LibraryEntry,
  ModelBinding,
} from '../types/footprint';
import { encodeAsset } from './caseAssets';
import { identifyAsset } from './modelSources';

type Prepared = {
  module: string;
  resolved: string;
  info: FootprintInfo;
  mapping: Record<string, string>;
  yaml: string;
  parameters: Record<string, { type: string; value: unknown }>;
};
type ModelInfo = { bounds: number[][]; stl: string; vrml: string };
const WORKER_TIMEOUT_MS = 120000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_FILES = 500;

function runWorker<T>(
  worker: Worker,
  payload: object,
  signal: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const finish = (error: unknown, result?: T) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      worker.terminate();
      if (error) {
        reject(error);
      } else {
        resolve(result!);
      }
    };
    const cancel = () =>
      finish(new DOMException('Import aborted', 'AbortError'));
    const timer = setTimeout(
      () =>
        finish(new Error('Import timed out. Retry or choose another file.')),
      WORKER_TIMEOUT_MS
    );
    worker.onerror = (event) =>
      finish(
        new Error(event.message || 'Import worker failed. Retry the import.')
      );
    worker.onmessage = ({ data }) => {
      if (data.requestId && data.requestId !== requestId) {
        return;
      }
      finish(data.error ? new Error(data.error) : null, data.result || data);
    };
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener('abort', cancel, { once: true });
    worker.postMessage({ ...payload, requestId });
  });
}
export function prepareFootprint(
  entry: LibraryEntry,
  signal: AbortSignal,
  params: Record<string, unknown> = {}
) {
  return runWorker<Prepared>(
    new Worker(new URL('../workers/footprint.worker.ts', import.meta.url), {
      type: 'module',
    }),
    { entry, params },
    signal
  );
}
export async function prepareModel(
  name: string,
  source: string,
  signal: AbortSignal,
  sourceUrl?: string
) {
  const identity = await identifyAsset(name, source);
  const info = await runWorker<ModelInfo>(
    new Worker(new URL('../workers/model.worker.ts', import.meta.url), {
      type: 'module',
    }),
    { name, source },
    signal
  );
  signal.throwIfAborted();
  const portable = /\.stl$/i.test(identity.path)
    ? identity.path.replace(/\.stl$/i, '.wrl')
    : identity.path;
  const model: ModelBinding = {
    path: `${'${KIPRJMOD}'}/models/${portable}`,
    asset: identity.path,
    hash: identity.hash,
    sourceUrl,
    offset: [0, 0, 0],
    rotate: [0, 0, 0],
    scale: [1, 1, 1],
  };
  const assets = {
    [identity.path]: source,
    [`__model_${identity.path}.json`]: JSON.stringify(info),
    ...(portable !== identity.path
      ? {
          [portable]: info.vrml,
          [`__model_${portable}.json`]: JSON.stringify(info),
        }
      : {}),
  };
  return { model, assets };
}
export type ImportFile = {
  name: string;
  source: string;
  kind: 'kicad' | 'ergogen' | 'model';
  error?: string;
};
export async function readFootprintFiles(files: File[], signal: AbortSignal) {
  const entries: ImportFile[] = [];
  let total = 0;
  const add = (name: string, source: string) => {
    if (entries.length >= MAX_BATCH_FILES) {
      throw new Error('Choose at most 500 files per import.');
    }
    const kind = /\.kicad_mod$/i.test(name)
      ? 'kicad'
      : /\.js$/i.test(name)
        ? 'ergogen'
        : /\.(step|stp|stl|wrl|vrml)$/i.test(name)
          ? 'model'
          : undefined;
    if (kind) {
      entries.push({ name, source, kind });
    }
  };
  for (const file of files) {
    signal.throwIfAborted();
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} exceeds the 50 MB limit.`);
    }
    if (!/\.zip$/i.test(file.name)) {
      total += file.size;
      if (total > MAX_FILE_BYTES) {
        throw new Error('Import exceeds the 50 MB limit.');
      }
      add(
        file.webkitRelativePath || file.name,
        /\.stl$/i.test(file.name)
          ? encodeAsset(new Uint8Array(await file.arrayBuffer()))
          : await file.text()
      );
      continue;
    }
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    for (const [name, item] of Object.entries(zip.files)) {
      signal.throwIfAborted();
      if (item.dir || !/\.(kicad_mod|js|step|stp|stl|wrl|vrml)$/i.test(name)) {
        continue;
      }
      const bytes = await item.async('uint8array');
      total += bytes.length;
      if (total > MAX_FILE_BYTES) {
        throw new Error('Expanded archive exceeds the 50 MB import limit.');
      }
      add(
        name,
        /\.stl$/i.test(name)
          ? encodeAsset(bytes)
          : new TextDecoder().decode(bytes)
      );
    }
  }
  return entries;
}

export function inspectFootprint(
  source: string,
  target: FootprintTarget,
  signal: AbortSignal
) {
  return runWorker<FootprintInfo>(
    new Worker(new URL('../workers/footprint.worker.ts', import.meta.url), {
      type: 'module',
    }),
    { action: 'inspect', source, target },
    signal
  ).then(localFootprint);
}
export function countUses(
  projects: { config: string }[],
  alias: string,
  signal: AbortSignal
) {
  return runWorker<{ placements: number; projects: number; unchecked: number }>(
    new Worker(new URL('../workers/footprint.worker.ts', import.meta.url), {
      type: 'module',
    }),
    { action: 'count', projects, alias },
    signal
  );
}
export async function prepareBundle(
  models: ModelBinding[],
  files: ImportFile[],
  signal: AbortSignal
) {
  let assets: Record<string, string> = {};
  const bindings: ModelBinding[] = [];
  const pool = Object.fromEntries(
    files
      .filter((file) => file.kind === 'model')
      .map((file) => [file.name, file.source])
  );
  const { findAsset } = await import('./caseAssets');
  for (const model of models) {
    const name = findAsset(model.path, pool);
    if (!name) {
      bindings.push(model);
      continue;
    }
    const imported = await prepareModel(name, pool[name], signal);
    assets = { ...assets, ...imported.assets };
    bindings.push({
      ...imported.model,
      offset: model.offset,
      rotate: model.rotate,
      scale: model.scale,
    });
  }
  return {
    models: bindings,
    assets,
    modelMode: bindings.some((model) => model.asset)
      ? ('replace' as const)
      : ('preserve' as const),
  };
}

function localFootprint(info: FootprintInfo): FootprintInfo {
  const direction = info.side === 'B' ? -1 : 1;
  const point = (p: number[]) => (p.length ? [p[0], p[1] * direction] : []);
  return {
    ...info,
    pads: info.pads.map((p) => ({
      ...p,
      at: [
        ...point(p.at),
        (Number(p.at[2] || 0) - Number(info.at?.[2] || 0)) * direction,
      ],
    })),
    graphics: info.graphics.map((g) => ({
      ...g,
      start: point(g.start),
      end: point(g.end),
      mid: point(g.mid),
      center: point(g.center),
      points: g.points.map(point),
    })),
  };
}
