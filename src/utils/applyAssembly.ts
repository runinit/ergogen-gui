import { parse } from 'yaml';
import { compileSetup, DesignSetup, KeyAssembly } from './designSetup';
import { getValue, readStudio, removeObject, setValue } from './studioSource';
export function applyAssembly(
  source: string,
  ids: string[],
  setup: DesignSetup,
  policy: 'preserve' | 'replace'
): string {
  const recipe = parse(
    compileSetup({
      ...setup,
      columns: 1,
      rows: 1,
      thumbs: 0,
      controller: '',
      topology: 'single',
    })
  );
  const part = `assembly_${setup.family}_${setup.mounting}`;
  let result = setValue(source, ['parts', part], recipe.parts.key);
  const data = readStudio(source);
  for (const id of ids) {
    const item = data.layout.objects?.[id];
    if (item?.kind !== 'key') {
      continue;
    }
    if (item.locked || data.layout.clusters?.[item.cluster || '']?.locked) {
      throw new Error('Unlock selected keys before applying an assembly.');
    }
    const previous = getValue(source, [
      'meta',
      'studio',
      'templates',
      String(item.properties?.assembly_template || ''),
    ]) as KeyAssembly | undefined;
    const remap = (value: unknown): unknown => {
      if (typeof value === 'string') {
        if (value === 'C1') {
          return item.properties?.column_net || '{{column_net}}';
        }
        if (value === 'R1') {
          return item.properties?.row_net || '{{row_net}}';
        }
        return value.replaceAll('fingers_c1_r1', id);
      }
      if (Array.isArray(value)) {
        return value.map(remap);
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, remap(child)])
        );
      }
      return value;
    };
    const compiled = remap(recipe.layout.objects.fingers_c1_r1) as Record<
      string,
      unknown
    >;
    const footprints = compiled.footprints as Record<
      string,
      { placement?: unknown }
    >;
    const oldSwitch = item.footprints?.switch as
      | { placement?: unknown }
      | undefined;
    const baseline = previous?.switch;
    const baselinePose = baseline
      ? { at: [...baseline.at, 0], rotate: baseline.rotate }
      : undefined;
    if (
      policy === 'preserve' &&
      oldSwitch?.placement &&
      JSON.stringify(oldSwitch.placement) !== JSON.stringify(baselinePose)
    ) {
      footprints.switch.placement = oldSwitch.placement;
    }
    result = setValue(result, ['layout', 'objects', id], {
      ...item,
      part,
      models: compiled.models,
      footprints: { ...item.footprints, ...footprints },
      properties: {
        ...item.properties,
        assembly_template: setup.template.name,
      },
    });
    for (const role of ['diode', 'led'] as const) {
      const existing = Object.entries(data.layout.objects || {}).find(
        ([, member]) =>
          member.properties?.owner === id && member.properties?.role === role
      );
      if (!setup[role]) {
        if (existing) {
          result = removeObject(result, 'objects', existing[0]);
        }
        continue;
      }
      const componentPart = `assembly_${role}`;
      result = setValue(result, ['parts', componentPart], recipe.parts[role]);
      const name = existing?.[0] || `${id}_${role}`;
      if (!existing && data.layout.objects?.[name]) {
        throw new Error(`${name} already belongs to another component.`);
      }
      const compiledChild = remap(
        recipe.layout.objects[`fingers_c1_r1_${role}`]
      ) as Record<string, unknown>;
      const { cluster: _cluster, cell: _cell, ...child } = compiledChild;
      const baseline = previous?.[role];
      const old = existing?.[1];
      const customized =
        old &&
        baseline &&
        (JSON.stringify(old.placement?.at) !==
          JSON.stringify([...baseline.at, 0]) ||
          old.placement?.rotate !== baseline.rotate);
      result = setValue(result, ['layout', 'objects', name], {
        ...child,
        part: componentPart,
        ...(item.cluster ? { cluster: item.cluster } : {}),
        ...(item.cell ? { cell: item.cell } : {}),
        pcb: item.pcb,
        ...(policy === 'preserve' && customized
          ? { placement: old.placement }
          : {}),
      });
    }
  }
  return setValue(
    result,
    ['meta', 'studio', 'templates', setup.template.name],
    setup.template
  );
}
