import { parseDocument } from 'yaml';
import type { SourcePath } from './designSource';

// Retain only the latest source. Clones prevent an edit from corrupting later reads.
let cached:
  | {
      source: string;
      document: ReturnType<typeof parseDocument>;
      value: unknown;
    }
  | undefined;
function snapshot(source: string) {
  if (cached?.source === source) {
    return cached;
  }
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length) {
    throw new Error(document.errors[0].message);
  }
  cached = { source, document, value: document.toJS() };
  return cached;
}
export function sourceDocument(source: string) {
  return snapshot(source).document.clone();
}
export function sourceValue(source: string, path: SourcePath = []): unknown {
  const value = path.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)[key]
        : undefined,
    snapshot(source).value
  );
  return structuredClone(value);
}
