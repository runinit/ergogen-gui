import { getValue, readStudio, setValue } from './studioSource';

type Params = Record<string, unknown>;
const paramsOf = (item: { footprints?: Record<string, unknown> }) =>
  (item.footprints?.main as { params?: Params } | undefined)?.params || {};

// Geometry edits leave wiring alone; topology edits reconnect only managed chains.
export function syncLedChains(before: string, source: string): string {
  const old = readStudio(before),
    next = readStudio(source);
  let result = source;
  const findings: string[] = [];
  for (const board of Object.keys(next.pcbs || {})) {
    const leds = (objects: typeof next.layout.objects) =>
      Object.entries(objects || {}).filter(
        ([, item]) =>
          item.pcb === board &&
          item.properties?.owner &&
          item.properties?.role === 'led'
      );
    const previous = leds(old.layout.objects),
      current = leds(next.layout.objects);
    const oldIds = previous.map(([id]) => id),
      ids = current.map(([id]) => id);
    if (JSON.stringify(oldIds) === JSON.stringify(ids)) {
      continue;
    }
    const order = [
      ...oldIds.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !oldIds.includes(id)),
    ];
    if (
      current.some(([, item]) => {
        const managed = item.properties?.generated_nets as Params | undefined;
        const params = paramsOf(item);
        return (
          !managed || ['P2', 'P4'].some((pin) => params[pin] !== managed[pin])
        );
      })
    ) {
      findings.push(
        `${board}: custom LED wiring needs review after changing the chain.`
      );
      continue;
    }
    let input = `${board === 'main' ? '' : `${board}_`}LED_DATA`;
    for (const id of order) {
      const item = next.layout.objects![id];
      const params = { ...paramsOf(item), P4: input, P2: `${id}_out` };
      result = setValue(
        result,
        ['layout', 'objects', id, 'footprints', 'main', 'params'],
        params
      );
      result = setValue(
        result,
        ['layout', 'objects', id, 'properties', 'generated_nets'],
        params
      );
      input = params.P2;
    }
  }
  const previousFindings = getValue(source, [
    'meta',
    'studio',
    'electricalFindings',
  ]) as string[] | undefined;
  if (findings.length) {
    result = setValue(
      result,
      ['meta', 'studio', 'electricalFindings'],
      Array.from(new Set([...(previousFindings || []), ...findings]))
    );
  }
  return result;
}
