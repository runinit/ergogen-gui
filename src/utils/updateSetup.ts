import { keepControllerPins, syncControllerNets } from './assemblyNets';
import { syncLedChains } from './assemblyWiring';
import { syncAssemblyMirrors } from './assemblyMirrors';
import { setupBaseline } from './setupRepair';
import { reviewResize } from './resizeReview';
import { parse } from 'yaml';
import { compileSetup, DesignSetup } from './designSetup';
import { getValue, removeValue, removeObject, setValue } from './studioSource';
import type { SourcePath } from './designSource';
const mapping = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
// Three-way updates preserve edited fields and deleted keys while applying setup defaults.
export function updateSetup(source: string, setup: DesignSetup): string {
  const previous = getValue(source, ['meta', 'studio', 'setup']) as
    | DesignSetup
    | undefined;
  if (!previous) {
    throw new Error(
      'This project has no saved setup. Edit its layout directly.'
    );
  }
  const before = parse(
    setupBaseline(
      previous,
      Number(getValue(source, ['meta', 'studio', 'setupRevision']) || 1)
    )
  );
  const next = parse(compileSetup(setup));
  const current = parse(source);
  const removed = Object.entries(current.layout.objects || {})
    .filter(
      ([id, item]) =>
        (item as { kind?: string }).kind === 'key' &&
        before.layout.objects[id] &&
        !next.layout.objects[id]
    )
    .map(([id]) => id);
  let result = source;
  for (const id of removed) {
    result = removeObject(result, 'objects', id);
  }
  const edited = parse(result);
  const merge = (
    base: unknown,
    edited: unknown,
    value: unknown,
    path: SourcePath
  ) => {
    if (JSON.stringify(base) === JSON.stringify(value)) {
      return;
    }
    if (JSON.stringify(base) === JSON.stringify(edited)) {
      result =
        value === undefined
          ? removeValue(result, path)
          : setValue(result, path, value);
      return;
    }
    if (!mapping(base) || !mapping(edited) || !mapping(value)) {
      return;
    }
    for (const key of Array.from(
      new Set([...Object.keys(base), ...Object.keys(value)])
    )) {
      merge(base[key], edited[key], value[key], [...path, key]);
    }
  };
  merge(before, edited, next, []);
  result = setValue(result, ['meta', 'studio', 'setup'], setup);
  result = syncControllerNets(
    keepControllerPins(
      source,
      syncAssemblyMirrors(source, syncLedChains(source, result))
    )
  );
  return reviewResize(source, result, removed);
}
