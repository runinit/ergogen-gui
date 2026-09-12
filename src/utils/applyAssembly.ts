import { syncAssemblySupport } from './assemblySupport';
import type { DesignSetup, KeyAssembly } from './designSetup';
import { assemblyParts, compileKey } from './keyAssembly';
import { keyNets, syncControllerNets } from './assemblyNets';
import { syncAssemblyMirrors } from './assemblyMirrors';
import { syncLedChains } from './assemblyWiring';
import {
  getValue,
  readStudio,
  removeObject,
  removeValue,
  setValue,
} from './studioSource';
export function applyAssembly(
  source: string,
  ids: string[],
  setup: DesignSetup,
  policy: 'preserve' | 'replace',
  scope: 'keys' | 'cluster' | 'column' | 'layout' = 'keys'
): string {
  const templates = (getValue(source, ['meta', 'studio', 'templates']) ||
    {}) as Record<string, KeyAssembly>;
  let template = {
    ...setup.template,
    options: {
      family: setup.family,
      mounting: setup.mounting,
      diode: setup.diode,
      led: setup.led,
    },
  };
  const originalName = template.name;
  while (
    templates[template.name] &&
    JSON.stringify(templates[template.name]) !== JSON.stringify(template)
  ) {
    template = {
      ...template,
      revision: template.revision + 1,
      name: `${originalName} (${template.revision + 1})`,
    };
  }
  setup = { ...setup, template };
  const parts = assemblyParts(setup);
  const part = `assembly_${setup.family}_${setup.mounting}`;
  let result = setValue(source, ['parts', part], parts.key);
  const data = readStudio(source);
  for (const id of ids) {
    const item = data.layout.objects?.[id];
    if (item?.kind !== 'key') {
      continue;
    }
    if (item.locked || data.layout.clusters?.[item.cluster || '']?.locked) {
      throw new Error('Unlock selected keys before applying an assembly.');
    }
    // Replace the old editor's managed attachments, retaining authored footprints.
    const managed = getValue(source, ['meta', 'studio', 'electronics', id]) as
      | Record<string, unknown>
      | undefined;
    if (managed) {
      for (const role of ['diode', 'led']) {
        if (managed[role]) {
          delete item.footprints?.[`studio_${role}`];
        }
      }
      result = removeValue(result, ['meta', 'studio', 'electronics', id]);
    }
    const previous = getValue(source, [
      'meta',
      'studio',
      'templates',
      String(item.properties?.assembly_template || ''),
    ]) as KeyAssembly | undefined;
    const recipe = compileKey(setup, id, {
      pcb: item.pcb,
      pcbThickness: data.pcbs?.[item.pcb || '']?.thickness,
      cluster: item.cluster,
      cell: item.cell,
      index: item.index,
      ...keyNets(source, id),
    });
    const compiled = recipe[id];
    const footprints = compiled.footprints as Record<
      string,
      { placement?: unknown; params?: Record<string, unknown> }
    >;
    const oldSwitch = item.footprints?.switch as
      | { placement?: unknown; params?: Record<string, unknown> }
      | undefined;
    footprints.switch = { ...oldSwitch, ...footprints.switch };
    // Placement updates must not reconnect manually wired switches.
    const netParams = footprints.switch.params!;
    const oldParams = oldSwitch?.params;
    if (oldParams?.from !== undefined) {
      netParams.from = oldParams.from;
    }
    if (
      oldParams?.to !== undefined &&
      !['{{row_net}}', '{{name}}_switch', `${id}_switch`].includes(
        String(oldParams.to)
      ) &&
      oldParams.to !== item.properties?.row_net
    ) {
      netParams.to = oldParams.to;
    }
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
    const pose = {
      at: [0, 0, 0],
      rotate: 0,
      ...(footprints.switch.placement as object),
    } as {
      at: number[];
      rotate: number;
    };
    let models = (compiled.models as Record<string, unknown>[]).map(
      (model) => ({
        ...model,
        offset: [...pose.at],
        rotate: [0, 0, pose.rotate],
      })
    );
    const existingModels = getValue(source, [
      'layout',
      'objects',
      id,
      'models',
    ]) as Record<string, unknown>[] | undefined;
    const baselineModels = previous
      ? compileKey({ ...setup, ...previous.options, template: previous }, id, {
          ...keyNets(source, id),
        })[id].models
      : undefined;
    if (
      policy === 'preserve' &&
      existingModels &&
      JSON.stringify(existingModels) !== JSON.stringify(baselineModels)
    ) {
      models = existingModels as typeof models;
    }
    result = setValue(result, ['layout', 'objects', id], {
      ...item,
      part,
      models,
      envelopes: {
        ...item.envelopes,
        body: {
          ...item.envelopes?.body,
          at: [...pose.at],
          rotate: pose.rotate,
        },
      },
      footprints: { ...item.footprints, ...footprints },
      properties: {
        ...(compiled.properties as object),
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
      result = setValue(result, ['parts', componentPart], parts[role]);
      const name = existing?.[0] || `${id}_${role}`;
      if (!existing && data.layout.objects?.[name]) {
        throw new Error(`${name} already belongs to another component.`);
      }
      const compiledChild = recipe[`${id}_${role}`];
      const { cluster: _cluster, cell: _cell, ...child } = compiledChild;
      if (existing) {
        if (existing[1].locked) {
          throw new Error(
            'Unlock owned components before applying an assembly.'
          );
        }
        const oldFootprint = existing[1].footprints?.main as
          | { params?: Record<string, unknown> }
          | undefined;
        const main = (
          child.footprints as Record<
            string,
            { params: Record<string, unknown> }
          >
        ).main;
        for (const pin of role === 'led'
          ? ['P1', 'P2', 'P3', 'P4']
          : ['from', 'to']) {
          if (oldFootprint?.params?.[pin] !== undefined) {
            main.params[pin] = oldFootprint.params[pin];
          }
        }
        child.properties = {
          ...(child.properties as object),
          generated_nets: existing[1].properties?.generated_nets,
        };
      }
      const baseline = previous?.[role];
      const old = existing?.[1];
      const customized =
        old &&
        (!baseline ||
          JSON.stringify(old.placement?.at) !==
            JSON.stringify([...baseline.at, 0]) ||
          old.placement?.rotate !== baseline.rotate ||
          (old as { side?: string }).side !==
            (baseline.side === 'F' ? 'top' : 'bottom'));
      result = setValue(result, ['layout', 'objects', name], {
        ...old,
        ...child,
        part: componentPart,
        envelopes: {
          ...old?.envelopes,
          ...(child.envelopes as object),
          body: {
            ...old?.envelopes?.body,
            ...(child.envelopes as { body: object }).body,
          },
        },
        ...(item.cluster ? { cluster: item.cluster } : {}),
        ...(item.cell ? { cell: item.cell } : {}),
        pcb: item.pcb,
        ...(policy === 'preserve' && customized
          ? {
              placement: old.placement,
              side: (old as { side?: string }).side,
              envelopes: old.envelopes,
              footprints: {
                main: {
                  ...(child.footprints as Record<string, object>).main,
                  params: {
                    ...(child.footprints as Record<string, { params: object }>)
                      .main.params,
                    side: (old as { side?: string }).side === 'top' ? 'F' : 'B',
                  },
                },
              },
            }
          : {}),
      });
    }
  }
  result = setValue(
    result,
    ['meta', 'studio', 'templates', setup.template.name],
    setup.template
  );
  if (scope !== 'keys') {
    for (const id of ids) {
      const item = data.layout.objects?.[id];
      const path =
        scope === 'layout'
          ? ['meta', 'studio', 'defaults']
          : scope === 'column'
            ? [
                'meta',
                'studio',
                'columns',
                item?.cluster || '',
                item?.cell?.[0] || '',
              ]
            : ['meta', 'studio', 'layouts', item?.cluster || ''];
      result = setValue(result, path, {
        ...(getValue(result, path) as object),
        assemblyTemplate: setup.template.name,
      });
    }
  }
  return syncControllerNets(
    syncAssemblySupport(
      syncAssemblyMirrors(source, syncLedChains(source, result))
    )
  );
}
