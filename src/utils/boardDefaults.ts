import { stringify } from 'yaml';
import { defaultSetup, type DesignSetup } from './designSetup';
import { assemblyParts } from './keyAssembly';
import { applyAssembly } from './applyAssembly';
import { getValue, readStudio, setValue } from './studioSource';
import { syncBoardTopology } from './boardTopology';
import { ensurePitchUnits, pitchUnits } from './designUnits';

const BOARD_REVISION = 3;
const MECHANICAL_DEFAULTS = { pcb: 1.6, plate: 1.5, gap: 5.4 };
export function createBoard(setup: DesignSetup = defaultSetup()): string {
  const boards = setup.topology === 'mirrored' ? ['left', 'right'] : ['main'];
  return stringify(
    {
      schema: 'ergogen/v1',
      meta: {
        name: setup.name,
        studio: {
          setupRevision: BOARD_REVISION,
          setup: structuredClone(setup),
          defaults: { pitch: ['u', 'v'] },
          templates: { [setup.template.name]: structuredClone(setup.template) },
          openSetup: true,
        },
      },
      units: {
        u: setup.pitch,
        v: (setup.pitchY ?? setup.pitch) === setup.pitch ? 'u' : setup.pitchY,
        pcb_thickness: MECHANICAL_DEFAULTS.pcb,
        plate_thickness: MECHANICAL_DEFAULTS.plate,
        plate_gap: MECHANICAL_DEFAULTS.gap,
      },
      parts: assemblyParts(setup),
      layout: {
        objects: {},
        clusters: {},
        layers: Object.fromEntries(
          boards.map((id) => [id, { surface: `pcb.${id}.top` }])
        ),
      },
      pcbs: Object.fromEntries(
        boards.map((id) => [id, { thickness: 'pcb_thickness' }])
      ),
      designs: {
        regions: {},
        profiles: {},
        stackups: Object.fromEntries(
          boards.map((id) => [
            id,
            {
              pcb: id,
              plate: { thickness: 'plate_thickness', gap: 'plate_gap' },
              layers: {},
            },
          ])
        ),
      },
    },
    { lineWidth: 100 }
  );
}

export function setupFromSource(source: string): DesignSetup {
  const saved = getValue(source, ['meta', 'studio', 'setup']) as
    | Partial<DesignSetup>
    | undefined;
  const units = pitchUnits(source);
  return { ...defaultSetup(), ...saved, pitch: units.u, pitchY: units.v };
}

// Defaults update inherited definitions, never regenerate the authored layout.
export function applyBoardDefaults(source: string, setup: DesignSetup): string {
  const previous = setupFromSource(source),
    data = readStudio(source);
  let next = ensurePitchUnits(source);
  if (setup.pitch !== previous.pitch) {
    next = setValue(next, ['units', 'u'], setup.pitch);
  }
  if ((setup.pitchY ?? setup.pitch) !== (previous.pitchY ?? previous.pitch)) {
    next = setValue(
      next,
      ['units', 'v'],
      (setup.pitchY ?? setup.pitch) === setup.pitch
        ? 'u'
        : (setup.pitchY ?? setup.pitch)
    );
  }
  const assemblyChanged = [
    'family',
    'mounting',
    'diode',
    'led',
    'template',
    'topology',
  ].some(
    (key) =>
      JSON.stringify(previous[key as keyof DesignSetup]) !==
      JSON.stringify(setup[key as keyof DesignSetup])
  );
  if (assemblyChanged) {
    const inherited =
      getValue(source, ['meta', 'studio', 'defaults', 'assemblyTemplate']) ||
      previous.template.name;
    const matching = (name: unknown) => {
      if (!name || name === inherited) {
        return true;
      }
      const recipe = getValue(source, [
        'meta',
        'studio',
        'templates',
        String(name),
      ]) as DesignSetup['template'] | undefined;
      return (
        !!recipe &&
        ['switch', 'diode', 'led'].every(
          (key) =>
            JSON.stringify(recipe[key as 'switch']) ===
            JSON.stringify(previous.template[key as 'switch'])
        ) &&
        (!recipe.options ||
          ['family', 'mounting', 'diode', 'led'].every(
            (key) =>
              recipe.options?.[key as 'family'] === previous[key as 'family']
          ))
      );
    };
    const keys = Object.entries(data.layout.objects || {})
      .filter(
        ([, item]) =>
          item.kind === 'key' &&
          !item.locked &&
          !data.layout.clusters?.[item.cluster || '']?.locked &&
          matching(item.properties?.assembly_template)
      )
      .map(([id]) => id);
    next = applyAssembly(next, keys, setup, 'preserve', 'layout');
  }
  next = setValue(next, ['meta', 'studio', 'openSetup'], false);
  next = setValue(next, ['meta', 'name'], setup.name);
  next = setValue(next, ['meta', 'studio', 'setup'], setup);
  next = setValue(next, ['meta', 'studio', 'setupRevision'], BOARD_REVISION);
  const defaults = (getValue(next, ['meta', 'studio', 'defaults']) ||
    {}) as object;
  next = setValue(next, ['meta', 'studio', 'defaults'], {
    ...defaults,
    pitch: ['u', 'v'],
  });
  return syncBoardTopology(next);
}
