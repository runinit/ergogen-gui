import { assetBytes, encodeAsset } from './caseAssets';

const MAX_MODEL_BYTES = 50 * 1024 * 1024;
const RATE_LIMIT = 429;
const NOT_FOUND = 404;
const KICAD_PROJECT = 'kicad/libraries/kicad-packages3D';
const MODEL_EXTENSIONS = /\.(step|stp|stl|wrl|vrml)$/i;

function gitlabFile(project: string, path: string, ref: string) {
  return `https://gitlab.com/api/v4/projects/${encodeURIComponent(project)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`;
}
export function modelUrl(input: string): string {
  const source = input.trim();
  const standard = source.match(
    /^\$\{(?:KICAD\d*_3DMODEL_DIR|KISYS3DMOD)\}\/(.+)$/
  );
  if (standard) {
    return gitlabFile(KICAD_PROJECT, standard[1], 'master');
  }
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Paste a public HTTPS model URL or upload the file.');
  }
  const github = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (url.hostname === 'github.com' && github) {
    return `https://raw.githubusercontent.com/${github[1]}/${github[2]}/${github[3]}`;
  }
  const gitlab = url.pathname.match(/^\/(.+)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/);
  if (url.hostname === 'gitlab.com' && gitlab) {
    return gitlabFile(
      decodeURIComponent(gitlab[1]),
      decodeURIComponent(gitlab[3]),
      decodeURIComponent(gitlab[2])
    );
  }
  return url.toString();
}
export async function identifyAsset(name: string, source: string) {
  const bytes = assetBytes(source);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes as Uint8Array<ArrayBuffer>
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const filename = name
    .split('/')
    .at(-1)!
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return { hash, path: `${hash}/${filename}` };
}
export async function fetchModel(
  input: string,
  signal: AbortSignal,
  download: typeof fetch = fetch
) {
  signal.throwIfAborted();
  const url = modelUrl(input);
  let response: Response;
  try {
    response = await download(url, { signal, credentials: 'omit' });
  } catch (error) {
    signal.throwIfAborted();
    throw new Error(
      `The browser could not download this model. Retry or upload the file. ${error instanceof Error ? error.message : ''}`
    );
  }
  if (response.status === RATE_LIMIT) {
    throw new Error(
      'Model source rate limit reached. Wait, retry, or upload the file.'
    );
  }
  if (response.status === NOT_FOUND) {
    throw new Error(
      'Model file unavailable. Check its path, retry, or upload the file.'
    );
  }
  if (!response.ok) {
    throw new Error(
      `Download failed (${response.status}). Retry or upload the file.`
    );
  }
  if (Number(response.headers.get('content-length')) > MAX_MODEL_BYTES) {
    throw new Error('Model exceeds the 50 MB import limit.');
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (!reader) {
    throw new Error('Empty model response. Retry or upload the file.');
  }
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.length;
      if (size > MAX_MODEL_BYTES) {
        throw new Error('Model exceeds the 50 MB import limit.');
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  signal.throwIfAborted();
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const modelPath = new URL(url).pathname;
  const apiFile = modelPath.match(/\/repository\/files\/(.+)\/raw$/);
  const name =
    decodeURIComponent(apiFile?.[1] || modelPath)
      .split('/')
      .at(-1) || 'model.step';
  if (
    !MODEL_EXTENSIONS.test(name) ||
    !size ||
    /^\s*</.test(new TextDecoder().decode(bytes.slice(0, 256)))
  ) {
    throw new Error(
      'The response is not a STEP, STL or VRML model. Upload the original model file.'
    );
  }
  const source = /\.stl$/i.test(name)
    ? encodeAsset(bytes)
    : new TextDecoder().decode(bytes);
  return { name, source, url, ...(await identifyAsset(name, source)) };
}
