import {
  getValue,
  readStudio,
  removeValue,
  setValue,
  type StudioItem,
} from './studioSource';

const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function mergeLinked(
  before: unknown,
  current: unknown,
  next: unknown
): unknown {
  if (equal(before, current) || current === undefined) {
    return next;
  }
  if (
    !before ||
    !current ||
    !next ||
    typeof before !== 'object' ||
    typeof current !== 'object' ||
    typeof next !== 'object' ||
    Array.isArray(current)
  ) {
    return current;
  }
  const old = before as Record<string, unknown>,
    edited = current as Record<string, unknown>,
    value = next as Record<string, unknown>;
  return Object.fromEntries(
    Array.from(new Set([...Object.keys(edited), ...Object.keys(value)])).map(
      (key) => [key, mergeLinked(old[key], edited[key], value[key])]
    )
  );
}
// Mirror overrides store board-specific nets. Refresh generated fields, retaining edits.
export function syncAssemblyMirrors(before: string, source: string): string {
  if (
    getValue(source, ['meta', 'studio', 'setup', 'topology']) !== 'mirrored'
  ) {
    return source;
  }
  const old = readStudio(before),
    data = readStudio(source);
  let result = source;
  for (const [id, cluster] of Object.entries(data.layout.clusters || {})) {
    if (!cluster.mirror) {
      continue;
    }
    const board =
      data.layout.layers?.[cluster.layer || '']?.surface?.match(
        /^pcb\.(.+)\.top$/
      )?.[1];
    if (!board) {
      continue;
    }
    const overrides = (getValue(source, [
      'layout',
      'clusters',
      id,
      'overrides',
    ]) || {}) as Record<string, StudioItem>;
    const project = (item: StudioItem) => {
      const prefix = item.pcb === 'main' ? '' : `${item.pcb}_`;
      const rename = (value: unknown): unknown => {
        if (typeof value === 'string' && prefix && value.startsWith(prefix)) {
          return `${board}_${value.slice(prefix.length)}`;
        }
        if (Array.isArray(value)) {
          return value.map(rename);
        }
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, rename(child)])
          );
        }
        return value;
      };
      const properties = rename(item.properties || {}) as Record<
        string,
        unknown
      >;
      if (item.properties?.owner) {
        properties.owner = `${id}__${item.properties.owner}`;
      }
      return {
        pcb: board,
        layer: cluster.layer,
        properties,
        footprints: rename(item.footprints),
      };
    };
    for (const [key, item] of Object.entries(data.layout.objects || {})) {
      if (item.cluster !== cluster.mirror.source) {
        continue;
      }
      const previous = old.layout.objects?.[key];
      const override = mergeLinked(
        previous ? project(previous) : undefined,
        overrides[key],
        project(item)
      );
      if (!equal(override, overrides[key])) {
        result = setValue(
          result,
          ['layout', 'clusters', id, 'overrides', key],
          override
        );
      }
    }
    for (const key of Object.keys(overrides)) {
      if (
        old.layout.objects?.[key]?.cluster === cluster.mirror.source &&
        !data.layout.objects?.[key]
      ) {
        result = removeValue(result, [
          'layout',
          'clusters',
          id,
          'overrides',
          key,
        ]);
      }
    }
  }
  return result;
}
