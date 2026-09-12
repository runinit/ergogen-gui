import { parseDocument } from 'yaml';
import { setLayout } from './layoutSource';
import type { SourcePath } from './designSource';

// Component tools edit the instance's physical definition, shared by layout and CAD.
export function editNativeBoard(
  source: string,
  path: SourcePath,
  value: unknown
): string | null {
  const data = parseDocument(source).toJS();
  if (
    data?.schema !== 'ergogen/v1' ||
    path[0] !== 'board' ||
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }
  const object = value as Record<string, unknown>;
  const sections = path.length === 1 ? object : { [String(path[1])]: object };
  if (!sections.components && !sections.models) {
    return null;
  }
  let result = source;
  for (const [id, definition] of Object.entries(
    (sections.components || {}) as Record<string, Record<string, unknown>>
  )) {
    if (!data.layout.objects?.[id]) {
      throw new Error('Edit generated component instances in Layout.');
    }
    for (const [field, value] of Object.entries(definition)) {
      if (value == null || !['size', 'height', 'body_offset'].includes(field)) {
        continue;
      }
      const key = field === 'body_offset' ? 'at' : field;
      result = setLayout(
        result,
        'objects',
        id,
        ['envelopes', 'body', key],
        field === 'body_offset' ? [...(value as number[]), 0] : value
      );
    }
  }
  for (const [id, models] of Object.entries(
    (sections.models || {}) as Record<string, unknown>
  )) {
    result = setLayout(result, 'objects', id, ['models'], models);
  }
  return result;
}
