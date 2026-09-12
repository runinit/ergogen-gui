import {
  prepareEntry,
  inspectFootprint,
  countUses,
} from '../utils/footprintEngine';
import type { LibraryEntry } from '../types/footprint';
self.onmessage = async ({
  data,
}: {
  data: { requestId: string } & (
    | {
        action: 'inspect';
        source: string;
        target: import('../types/footprint').FootprintTarget;
      }
    | { action: 'count'; projects: { config: string }[]; alias: string }
    | {
        action?: 'prepare';
        entry: LibraryEntry;
        params?: Record<string, unknown>;
      }
  );
}) => {
  try {
    self.postMessage({
      requestId: data.requestId,
      result:
        data.action === 'inspect'
          ? inspectFootprint(data.source, data.target)
          : data.action === 'count'
            ? countUses(data.projects, data.alias)
            : await prepareEntry(data.entry, data.params),
    });
  } catch (error) {
    self.postMessage({ requestId: data.requestId, error: String(error) });
  }
};
export {};
