import { parse } from 'yaml';
import { compileSetup, DesignSetup } from './designSetup';
import { getValue, removeValue, setValue } from './studioSource';
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
  const before = parse(compileSetup(previous));
  const next = parse(compileSetup(setup));
  const current = parse(source);
  let result = source;
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
  merge(before, current, next, []);
  return setValue(result, ['meta', 'studio', 'setup'], setup);
}
