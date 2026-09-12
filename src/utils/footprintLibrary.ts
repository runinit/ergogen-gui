import { identifyAsset } from './modelSources';
import { parse } from 'yaml';
import type JSZip from 'jszip';
import type { LibraryEntry } from '../types/footprint';
import { storageKey } from './storageKey';

const STORE = 'entries';
const MANIFEST = 'footprint-library.json';
const MARKER = '// ergogen-library: ';
const listeners = new Set<() => void>();
let snapshot: LibraryEntry[] = [];
let loading: Promise<void> | undefined;
let channel: BroadcastChannel | undefined;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(storageKey('ergogen-footprint-library'), 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function publish(entries: LibraryEntry[]) {
  snapshot = entries;
  listeners.forEach((listener) => listener());
}
export function librarySnapshot() {
  return snapshot;
}
export function watchLibrary(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function loadLibrary() {
  if (loading) {
    return loading;
  }
  loading = (async () => {
    const db = await database();
    const entries = await new Promise<LibraryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE);
      const request = tx.objectStore(STORE).getAll();
      tx.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    publish(entries);
    if (typeof BroadcastChannel !== 'undefined' && !channel) {
      channel = new BroadcastChannel(storageKey('footprint-library'));
      channel.onmessage = () => {
        loading = undefined;
        void loadLibrary().catch(() => undefined);
      };
    }
  })().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
export function createEntry(
  name: string,
  source: string,
  kind: LibraryEntry['origin']['kind']
): LibraryEntry {
  const id = crypto.randomUUID();
  const slug = name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'footprint';
  return {
    id,
    alias: `library/${slug}_${id}`,
    name,
    revision: 0,
    origin: { kind, original: source },
    module: source,
    resolved: source,
    mapping: {},
    models: [],
    modelMode: 'preserve',
    assets: {},
  };
}
export function saveRevision(
  draft: LibraryEntry,
  previous: LibraryEntry | undefined
): LibraryEntry {
  if ((previous?.revision || 0) !== draft.revision) {
    throw new Error(
      'This footprint changed in another editor. Reopen it before saving.'
    );
  }
  if (previous && previous.alias !== draft.alias) {
    throw new Error('A saved library identity cannot be renamed.');
  }
  return {
    ...draft,
    revision: draft.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}
export async function saveFootprint(draft: LibraryEntry) {
  const identity = await identifyAsset('source', draft.origin.original);
  draft = { ...draft, origin: { ...draft.origin, hash: identity.hash } };
  const db = await database();
  const saved = await new Promise<LibraryEntry>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(draft.id);
    let entry: LibraryEntry;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        entry = saveRevision(draft, request.result);
        store.put(entry);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(entry);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(failure || tx.error);
    };
  });
  publish([...snapshot.filter((entry) => entry.id !== saved.id), saved]);
  channel?.postMessage(saved.id);
  return saved;
}
function binding(source: string) {
  if (!source.startsWith(MARKER)) {
    return undefined;
  }
  try {
    return JSON.parse(source.slice(MARKER.length).split('\n')[0]) as {
      id: string;
      revision: number;
    };
  } catch {
    return undefined;
  }
}
export function entryInjection(entry: LibraryEntry) {
  return [
    'footprint',
    entry.alias,
    `${MARKER}${JSON.stringify({ id: entry.id, revision: entry.revision })}\n${entry.resolved}`,
  ];
}
export function resolveLibrary(
  injections: string[][] | undefined,
  entries: LibraryEntry[]
) {
  return injections?.map((injection) => {
    const identity = binding(injection[2] || '');
    const entry = entries.find(
      (entry) => entry.id === identity?.id && entry.alias === injection[1]
    );
    return entry ? entryInjection(entry) : injection;
  });
}
export function libraryAssets(
  injections: string[][] | undefined,
  entries: LibraryEntry[]
) {
  const ids = new Set(
    injections?.map((injection) => binding(injection[2] || '')?.id)
  );
  return Object.assign(
    {},
    ...entries.filter((entry) => ids.has(entry.id)).map((entry) => entry.assets)
  ) as Record<string, string>;
}
export function linkedUses(projects: { config: string }[], alias: string) {
  let count = 0;
  const countUses = (value: unknown): number => {
    if (!value || typeof value !== 'object') {
      return 0;
    }
    return Object.entries(value).reduce(
      (total, [key, item]) =>
        total + (key === 'what' && item === alias ? 1 : countUses(item)),
      0
    );
  };
  const declarations = projects.reduce((total, project) => {
    try {
      const uses = countUses(parse(project.config));
      if (uses) {
        count++;
      }
      return total + uses;
    } catch {
      return total;
    }
  }, 0);
  return { projects: count, declarations };
}
export function packageLibrary(
  zip: JSZip,
  injections: string[][] | undefined,
  entries = snapshot
) {
  const bindings =
    injections?.flatMap((injection) => {
      const identity = binding(injection[2] || '');
      return identity
        ? [{ ...identity, alias: injection[1], snapshot: injection[2] }]
        : [];
    }) || [];
  const linkedEntries = entries.filter((entry) =>
    bindings.some((binding) => binding.id === entry.id)
  );
  zip.file(
    MANIFEST,
    JSON.stringify({ version: 1, bindings, entries: linkedEntries }, null, 2)
  );
}
export async function restoreLibrary(zip: JSZip) {
  const file = zip.file(MANIFEST);
  if (!file) {
    return;
  }
  const manifest = JSON.parse(await file.async('string'));
  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error('Unsupported footprint library archive.');
  }
  await loadLibrary();
  // Local saved entries remain authoritative; a new browser adopts the exported snapshots.
  for (const entry of manifest.entries as LibraryEntry[]) {
    if (
      !entry.id ||
      !entry.alias?.startsWith('library/') ||
      typeof entry.resolved !== 'string' ||
      !entry.origin ||
      !entry.assets
    ) {
      throw new Error('Invalid footprint library snapshot.');
    }
    if (snapshot.some((local) => local.id === entry.id)) {
      continue;
    }
    // Keep snapshot revision and provenance; never overwrite an entry saved locally during import.
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get(entry.id);
      request.onsuccess = () => {
        if (!request.result) {
          store.put(entry);
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
  loading = undefined;
  await loadLibrary();
  channel?.postMessage('restored');
}
