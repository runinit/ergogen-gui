import { parse, stringify } from 'yaml';
import { compileSetup, type DesignSetup } from './designSetup';
import { SETUP_REVISION } from './keyAssembly';
import { getValue, setValue } from './studioSource';

// Reproduce the published generator's baseline, including mirrored bindings.
export function setupBaseline(
  setup: DesignSetup,
  revision = SETUP_REVISION
): string {
  const source = compileSetup(setup);
  if (revision >= SETUP_REVISION) {
    return source;
  }
  const doc = parse(source);
  const revert = (value: Record<string, unknown>) => {
    const properties = value.properties as
      | { role?: string; generated_nets?: unknown }
      | undefined;
    if (properties) {
      delete properties.generated_nets;
    }
    if (properties?.role === 'led') {
      const binding = (
        value.footprints as Record<string, { params: Record<string, unknown> }>
      ).main;
      [binding.params.P2, binding.params.P4] = [
        binding.params.P4,
        binding.params.P2,
      ];
    }
  };
  for (const object of Object.values(doc.layout.objects)) {
    revert(object as Record<string, unknown>);
  }
  for (const cluster of Object.values(doc.layout.clusters)) {
    for (const object of Object.values(
      (cluster as { overrides?: object }).overrides || {}
    )) {
      revert(object);
    }
  }
  for (const id of Object.keys(doc.pcbs)) {
    doc.designs.regions[id].envelope = 'pcb';
  }
  delete doc.meta.studio.setupRevision;
  return stringify(doc);
}
export function repairSetup(source: string): string {
  const setup = getValue(source, ['meta', 'studio', 'setup']) as
    | DesignSetup
    | undefined;
  const revision = Number(
    getValue(source, ['meta', 'studio', 'setupRevision']) || 1
  );
  if (!setup || revision >= SETUP_REVISION) {
    return source;
  }
  const old = parse(setupBaseline(setup, revision)),
    next = parse(compileSetup(setup));
  let result = source;
  const findings: string[] = [];
  const repair = (
    path: string[],
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ) => {
    const properties = before.properties as { role?: string } | undefined;
    if (properties?.role !== 'led' && properties?.role !== 'diode') {
      return;
    }
    const paramsPath = [...path, 'footprints', 'main', 'params'];
    const oldParams = (before.footprints as Record<string, { params: object }>)
      .main.params;
    const newParams = (after.footprints as Record<string, { params: object }>)
      .main.params;
    const current = getValue(result, paramsPath);
    if (current === undefined) {
      return;
    }
    if (JSON.stringify(current) === JSON.stringify(oldParams)) {
      result = setValue(result, paramsPath, newParams);
      result = setValue(
        result,
        [...path, 'properties', 'generated_nets'],
        structuredClone(newParams)
      );
    } else if (properties.role === 'led') {
      findings.push(
        `${path.at(-1)}: custom LED wiring needs review before automatic chain repair.`
      );
    }
  };
  for (const [id, item] of Object.entries(old.layout.objects)) {
    repair(
      ['layout', 'objects', id],
      item as Record<string, unknown>,
      next.layout.objects[id]
    );
  }
  for (const [id, cluster] of Object.entries(old.layout.clusters)) {
    for (const [key, item] of Object.entries(
      (cluster as { overrides?: object }).overrides || {}
    )) {
      repair(
        ['layout', 'clusters', id, 'overrides', key],
        item,
        next.layout.clusters[id].overrides[key]
      );
    }
  }
  for (const id of Object.keys(old.pcbs)) {
    const path = ['designs', 'regions', id];
    if (
      JSON.stringify(getValue(result, path)) ===
      JSON.stringify(old.designs.regions[id])
    ) {
      result = setValue(result, path, next.designs.regions[id]);
    }
  }
  if (findings.length) {
    result = setValue(
      result,
      ['meta', 'studio', 'electricalFindings'],
      findings
    );
  }
  return setValue(result, ['meta', 'studio', 'setupRevision'], SETUP_REVISION);
}
