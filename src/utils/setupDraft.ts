import { parse } from 'yaml';
import { getValue, setValue, removeValue } from './studioSource';

const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const mapping = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// Apply only staged changes, preserving edits made on the canvas while setup is open.
export function mergeSetupDraft(
  base: string,
  draft: string,
  current: string
): string {
  let next = current;
  const visit = (before: unknown, after: unknown, path: string[]) => {
    if (equal(before, after)) {
      return;
    }
    if (mapping(before) && mapping(after)) {
      for (const key of Array.from(
        new Set([...Object.keys(before), ...Object.keys(after)])
      )) {
        visit(before[key], after[key], [...path, key]);
      }
      return;
    }
    const latest = getValue(current, path);
    if (!equal(latest, before) && !equal(latest, after)) {
      throw new Error(
        `${path.join('.')} changed while setup was open. Reopen setup to use the latest value.`
      );
    }
    next =
      after === undefined
        ? removeValue(next, path)
        : setValue(next, path, after);
  };
  visit(parse(base), parse(draft), []);
  return next;
}
