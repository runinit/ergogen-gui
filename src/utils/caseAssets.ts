import JSZip from 'jszip';
import { storageKey } from './storageKey';
export type CaseAssets = Record<string, string>;
const STORE = 'assets';
const PROJECTS = 'projects';
const BINARY = 'base64:';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(storageKey('ergogen-case-assets'), 2);
    request.onupgradeneeded = () => {
      for (const name of [STORE, PROJECTS]) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadProjectAssets(id: string): Promise<CaseAssets> {
  const db = await database();
  const assets = await new Promise<CaseAssets | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(PROJECTS),
        request = tx.objectStore(PROJECTS).get(id);
      tx.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    }
  );
  // Existing projects inherit the old asset store once, then own their snapshot.
  if (assets !== undefined) {
    return assets;
  }
  const migrated = await loadAssets();
  await saveProjectAssets(id, migrated);
  return migrated;
}
export async function saveProjectAssets(
  id: string,
  assets: CaseAssets
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, 'readwrite');
    tx.objectStore(PROJECTS).put(assets, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function loadAssets(): Promise<CaseAssets> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE),
      store = tx.objectStore(STORE),
      keys = store.getAllKeys(),
      values = store.getAll();
    tx.oncomplete = () => {
      db.close();
      resolve(
        Object.fromEntries(
          keys.result.map((key, i) => [String(key), values.result[i]])
        )
      );
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function saveAssets(assets: CaseAssets) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    for (const [key, value] of Object.entries(assets)) {
      tx.objectStore(STORE).put(value, key);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export function encodeAsset(bytes: Uint8Array) {
  let text = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return BINARY + btoa(text);
}
export function assetBytes(value: string) {
  return value.startsWith(BINARY)
    ? Uint8Array.from(atob(value.slice(BINARY.length)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(value);
}
export async function readAssets(
  file: File
): Promise<{ assets: CaseAssets; config?: string }> {
  if (!file.name.endsWith('.zip')) {
    return {
      assets: {
        [file.name]: /\.stl$/i.test(file.name)
          ? encodeAsset(new Uint8Array(await file.arrayBuffer()))
          : await file.text(),
      },
    };
  }
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  return readArchiveAssets(zip);
}
export async function readArchiveAssets(zip: JSZip) {
  const assets: CaseAssets = {};
  const config = await zip.file('config.yaml')?.async('string');
  const manifest = zip.file('case-assets.json');
  if (manifest) {
    const names = JSON.parse(await manifest.async('string'));
    if (!Array.isArray(names) || names.length > 5000) {
      throw new Error('Invalid case asset manifest.');
    }
    for (const name of names) {
      if (typeof name !== 'string' || name.split('/').includes('..')) {
        throw new Error('Invalid case asset path.');
      }
      const entry = zip.file(`assets/${name}`);
      if (!entry) {
        throw new Error(`Project archive is missing ${name}.`);
      }
      if (entry) {
        assets[name] = /\.stl$/i.test(name)
          ? encodeAsset(await entry.async('uint8array'))
          : await entry.async('string');
      }
    }
  } else {
    for (const [name, entry] of Object.entries(zip.files)) {
      if (!entry.dir && /\.(kicad_pcb|step|stp|stl|wrl|vrml)$/i.test(name)) {
        assets[name] = /\.stl$/i.test(name)
          ? encodeAsset(await entry.async('uint8array'))
          : await entry.async('string');
      }
    }
  }
  return { assets, config };
}
export function packageAssets(
  zip: JSZip,
  assets: CaseAssets,
  boards: string[] = []
) {
  const directories = Array.from(
    new Set([
      '',
      ...boards.map((name) =>
        name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : ''
      ),
    ])
  );
  zip.file('case-assets.json', JSON.stringify(Object.keys(assets), null, 2));
  for (const [name, value] of Object.entries(assets)) {
    zip.file(
      `assets/${name}`,
      value.startsWith(BINARY) ? assetBytes(value) : value
    );
    if (/\.(step|stp|wrl|vrml)$/i.test(name)) {
      zip.file(
        `models/${name}`,
        value.startsWith(BINARY) ? assetBytes(value) : value
      );
      for (const directory of directories) {
        zip.file(
          `outputs/pcbs/${directory}models/${name}`,
          value.startsWith(BINARY) ? assetBytes(value) : value
        );
      }
    }
  }
}

// Resolve full project paths before using a unique filename fallback.
export function findAsset(path: string, assets: CaseAssets) {
  const local = path
    .replace(/^\$\{KIPRJMOD\}\/models\//, '')
    .replace(/^\$\{KIPRJMOD\}\//, '');
  if (assets[local] !== undefined) {
    return local;
  }
  const matches = Object.keys(assets).filter(
    (name) => name.split('/').at(-1) === path.split('/').at(-1)
  );
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous model ${path}. Choose its full asset path in Components.`
    );
  }
  return matches[0];
}
