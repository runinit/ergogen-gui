import {
  getValue,
  readStudio,
  removeValue,
  setValue,
  type StudioItem,
} from './studioSource';

// Keep generated component regions in step with optional owned electronics.
export function syncAssemblySupport(source: string): string {
  if (!getValue(source, ['meta', 'studio', 'setup'])) {
    return source;
  }
  const document = readStudio(source);
  let result = source;
  const components = Object.values(document.layout.objects || {}).filter(
    (item) => item.kind === 'component'
  );
  for (const [id, cluster] of Object.entries(document.layout.clusters || {})) {
    if (!cluster.mirror) {
      continue;
    }
    const overrides = (getValue(source, [
      'layout',
      'clusters',
      id,
      'overrides',
    ]) || {}) as Record<string, StudioItem>;
    for (const [key, item] of Object.entries(overrides)) {
      if (document.layout.objects?.[key]?.kind === 'component') {
        components.push(item);
      }
    }
  }
  for (const board of Object.keys(document.pcbs || {})) {
    const region = `${board}_components`,
      ref = `regions.${region}`;
    const boundary = getValue(result, ['designs', 'boundaries', board]) as
      | { from?: string[] }
      | undefined;
    if (!boundary?.from?.includes(`regions.${board}`)) {
      continue;
    }
    const expected = {
      select: { pcb: board, kind: 'component' },
      envelope: 'pcb',
    };
    const existing = document.designs?.regions?.[region];
    if (!components.some((item) => item.pcb === board)) {
      if (JSON.stringify(existing) !== JSON.stringify(expected)) {
        continue;
      }
      result = setValue(
        result,
        ['designs', 'boundaries', board, 'from'],
        boundary.from.filter((value) => value !== ref)
      );
      result = removeValue(result, ['designs', 'regions', region]);
      continue;
    }
    if (!existing) {
      result = setValue(result, ['designs', 'regions', region], expected);
    }
    if (!boundary.from.includes(ref)) {
      result = setValue(
        result,
        ['designs', 'boundaries', board, 'from'],
        [...boundary.from, ref]
      );
    }
  }
  return result;
}
