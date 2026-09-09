import * as ergogen from 'ergogen';
import { createInjectionModule } from './injectionEvaluator';
import type { FootprintInfo, LibraryEntry } from '../types/footprint';

type Module = {
  params: Record<string, unknown>;
  body: (params: unknown) => string;
};
const PREVIEW_NAME = 'library_preview';

export async function prepareEntry(
  entry: LibraryEntry,
  params: Record<string, unknown> = {}
) {
  const conversion =
    entry.origin.kind === 'kicad'
      ? ergogen.footprints.convert(entry.origin.original, {
          name: entry.alias,
          mapping: entry.mapping,
        })
      : undefined;
  const source = conversion?.source || entry.module;
  const resolved =
    entry.modelMode === 'replace'
      ? ergogen.footprints.bind(source, entry.models, entry.target)
      : source;
  const module = createInjectionModule(source) as Module;
  const parameters = Object.fromEntries(
    Object.entries(module.params || {}).map(([key, spec]) => {
      const definition =
        spec && typeof spec === 'object'
          ? (spec as { type?: string; value?: unknown })
          : undefined;
      const type =
        definition?.type || (spec === undefined ? 'net' : typeof spec);
      return [
        key,
        { type, value: definition?.value ?? (definition ? '' : spec) ?? '' },
      ];
    })
  );
  ergogen.inject('footprint', PREVIEW_NAME, module);
  const previewParams = {
    ...Object.fromEntries(
      Object.entries(parameters)
        .filter(([, spec]) => spec.type === 'net')
        .map(([key]) => [key, `preview_${key}`])
    ),
    ...params,
  };
  const results = await ergogen.process(
    {
      schema: 'ergogen/v1',
      layout: {
        objects: {
          preview: {
            kind: 'component',
            pcb: 'preview',
            footprints: {
              part: { what: PREVIEW_NAME, params: previewParams },
            },
          },
        },
      },
      designs: {
        regions: { preview: { shape: { size: [20, 20] } } },
        profiles: { preview: { from: 'regions.preview' } },
      },
      pcbs: { preview: { profile: 'profiles.preview' } },
    },
    { debug: true }
  );
  const emitted = results.pcbs.preview;
  let info: FootprintInfo = ergogen.footprints.inspect(emitted, entry.target);
  if (entry.modelMode === 'replace') {
    // Selecting the target is validated by the same parser used at generation time.
    ergogen.footprints.models(emitted, entry.models, entry.target);
  }
  if (conversion) {
    info = { ...info, diagnostics: conversion.diagnostics };
  }
  return {
    module: source,
    resolved,
    info,
    parameters,
    mapping: conversion?.mapping || entry.mapping,
    yaml: conversion?.yaml || `what: ${entry.alias}\nparams: {}`,
  };
}

export function inspectFootprint(
  source: string,
  target: import('../types/footprint').FootprintTarget
) {
  return ergogen.footprints.inspect(source, target) as FootprintInfo;
}
export function countUses(projects: { config: string }[], alias: string) {
  let placements = 0,
    linked = 0,
    unchecked = 0;
  for (const project of projects) {
    try {
      const count = ergogen.footprints.countUses(project.config, alias);
      placements += count;
      linked += count > 0 ? 1 : 0;
    } catch {
      unchecked++;
    }
  }
  return { placements, projects: linked, unchecked };
}
