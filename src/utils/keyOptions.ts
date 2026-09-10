import { applyAssembly } from './applyAssembly';
import {
  defaultSetup,
  type DesignSetup,
  type KeyAssembly,
} from './designSetup';
import { getValue, setValue, removeValue, readStudio } from './studioSource';
import { setLayout } from './layoutSource';

export interface KeyOptions {
  size: (number | string)[];
  pitch: (number | string)[];
  diode: boolean;
  led: boolean;
  diodeAt: number[];
  ledAt: number[];
  assemblyTemplate?: string;
}
const DEFAULT_KEY_OPTIONS: KeyOptions = {
  size: [18, 18],
  pitch: [19, 19],
  diode: true,
  led: false,
  diodeAt: [0, -5, 0],
  ledAt: [0, 5, 0],
};
export function keyOptions(
  source: string,
  cluster = '',
  column = ''
): KeyOptions {
  const setup = getValue(source, ['meta', 'studio', 'setup']) as
    | DesignSetup
    | undefined;
  const templateOptions = (template: KeyAssembly): Partial<KeyOptions> => ({
    size: template.options?.family?.startsWith('choc')
      ? [17.5, 16.5]
      : [18, 18],
    diode: template.options?.diode ?? setup?.diode ?? DEFAULT_KEY_OPTIONS.diode,
    led: template.options?.led ?? setup?.led ?? DEFAULT_KEY_OPTIONS.led,
    diodeAt: [...template.diode.at, 0],
    ledAt: [...template.led.at, 0],
  });
  let options = {
    ...DEFAULT_KEY_OPTIONS,
    ...(setup
      ? {
          pitch: [setup.pitch, setup.pitch],
          ...templateOptions(setup.template),
        }
      : {}),
  };
  for (const path of [
    ['defaults'],
    ['layouts', cluster],
    ['columns', cluster, column],
  ]) {
    const custom = (getValue(source, ['meta', 'studio', ...path]) ||
      {}) as Partial<KeyOptions>;
    const template =
      custom.assemblyTemplate &&
      (getValue(source, [
        'meta',
        'studio',
        'templates',
        custom.assemblyTemplate,
      ]) as KeyAssembly | undefined);
    options = {
      ...options,
      ...(template ? templateOptions(template) : {}),
      ...custom,
    };
  }
  return options;
}

export function setKeyOptions(
  source: string,
  options: Partial<KeyOptions>,
  cluster = ''
): string {
  if (cluster && readStudio(source).layout.clusters?.[cluster]?.locked) {
    throw new Error('Unlock the matrix before changing its defaults.');
  }
  const path = cluster
    ? ['meta', 'studio', 'layouts', cluster]
    : ['meta', 'studio', 'defaults'];
  return setValue(source, path, {
    ...((getValue(source, path) as object) || {}),
    ...options,
  });
}

export function hasElectronics(
  source: string,
  id: string,
  role: 'diode' | 'led'
): boolean {
  return (
    Object.values(readStudio(source).layout.objects || {}).some(
      (item) => item.properties?.owner === id && item.properties?.role === role
    ) ||
    !!getValue(source, [
      'layout',
      'objects',
      id,
      'footprints',
      `studio_${role}`,
    ])
  );
}
export function electronicsAt(
  source: string,
  id: string,
  role: 'diode' | 'led'
): number[] {
  const data = readStudio(source);
  const owned = Object.values(data.layout.objects || {}).find(
    (item) => item.properties?.owner === id && item.properties?.role === role
  );
  return (owned?.placement?.at ||
    getValue(source, [
      'layout',
      'objects',
      id,
      'footprints',
      `studio_${role}`,
      'placement',
      'at',
    ]) ||
    keyOptions(source, data.layout.objects?.[id]?.cluster)[
      role === 'diode' ? 'diodeAt' : 'ledAt'
    ]) as number[];
}
export function keySetup(source: string, id: string): DesignSetup | undefined {
  const saved = getValue(source, ['meta', 'studio', 'setup']) as
    | DesignSetup
    | undefined;
  const item = readStudio(source).layout.objects?.[id];
  const options = keyOptions(source, item?.cluster, item?.cell?.[0]);
  const name = item?.properties?.assembly_template || options.assemblyTemplate;
  const template = getValue(source, [
    'meta',
    'studio',
    'templates',
    String(name || saved?.template.name || ''),
  ]) as KeyAssembly | undefined;
  if (!saved && !template) {
    return undefined;
  }
  const resolved = template || saved!.template;
  const inherited = item?.properties?.assembly_template
    ? {}
    : {
        diode: options.diode,
        led: options.led,
        template: {
          ...resolved,
          diode: {
            ...resolved.diode,
            at: [options.diodeAt[0], options.diodeAt[1]] as [number, number],
          },
          led: {
            ...resolved.led,
            at: [options.ledAt[0], options.ledAt[1]] as [number, number],
          },
        },
      };
  return {
    ...(saved || defaultSetup()),
    ...resolved.options,
    template: resolved,
    ...inherited,
  };
}

// Save only managed bindings so disabling an option restores authored wiring.
export function keyElectronics(
  source: string,
  id: string,
  options: Pick<KeyOptions, 'diode' | 'led' | 'diodeAt' | 'ledAt'>
): string {
  const item = readStudio(source).layout.objects?.[id];
  if (!item || item.kind !== 'key') {
    return source;
  }
  const setup = keySetup(source, id);
  if (setup) {
    return applyAssembly(
      source,
      [id],
      {
        ...setup,
        diode: options.diode,
        led: options.led,
        template: {
          ...setup.template,
          diode: {
            ...setup.template.diode,
            at: [options.diodeAt[0], options.diodeAt[1]],
          },
          led: {
            ...setup.template.led,
            at: [options.ledAt[0], options.ledAt[1]],
          },
        },
      },
      'preserve'
    );
  }
  let result = source;
  for (const kind of ['diode', 'led'] as const) {
    const name = `studio_${kind}`;
    const ownedPath = ['meta', 'studio', 'electronics', id, kind];
    const saved = getValue(result, ownedPath) as
      | { switch?: unknown }
      | undefined;
    const bindingPath = ['layout', 'objects', id, 'footprints', name];
    if (!options[kind]) {
      if (!saved) {
        continue;
      }
      // Check locks before any removal or restoration.
      result = setLayout(
        result,
        'objects',
        id,
        ['footprints', name],
        getValue(result, bindingPath)
      );
      result = removeValue(result, bindingPath);
      if (kind === 'diode') {
        result =
          saved.switch === null
            ? removeValue(result, [
                'layout',
                'objects',
                id,
                'footprints',
                'switch',
              ])
            : setLayout(
                result,
                'objects',
                id,
                ['footprints', 'switch'],
                saved.switch
              );
      }
      result = removeValue(result, ownedPath);
      continue;
    }
    if (!saved && getValue(result, bindingPath)) {
      throw new Error(
        `${name} is already authored on ${id}. Rename it before enabling the preset.`
      );
    }
    const at = kind === 'diode' ? options.diodeAt : options.ledAt;
    if (!saved) {
      result = setValue(
        result,
        ownedPath,
        kind === 'diode'
          ? {
              switch:
                getValue(result, [
                  'layout',
                  'objects',
                  id,
                  'footprints',
                  'switch',
                ]) ?? null,
            }
          : {}
      );
    }
    if (kind === 'diode') {
      const part = readStudio(result).parts?.[item.part || ''];
      const switchBinding = {
        ...((part?.footprints?.switch as object) || {}),
        ...((item.footprints?.switch as object) || {}),
      } as { what?: string; params?: object };
      if (!switchBinding.what) {
        throw new Error(
          `Define a switch footprint on ${id} before adding a diode.`
        );
      }
      const instance =
        (getValue(result, [
          'layout',
          'objects',
          id,
          'footprints',
          'switch',
        ]) as { params?: object }) || {};
      result = setLayout(result, 'objects', id, ['footprints', 'switch'], {
        ...instance,
        params: { ...instance.params, to: '{{name}}_switch' },
      });
      result = setLayout(result, 'objects', id, ['footprints', name], {
        what: 'diode',
        placement: { at },
        params: { from: '{{name}}_switch', to: '{{row_net}}' },
      });
    } else {
      result = setLayout(result, 'objects', id, ['footprints', name], {
        what: 'ceoloide/led_sk6812mini-e',
        placement: { at },
        params: {
          side: 'B',
          include_traces_vias: false,
          P1: 'VCC',
          P3: 'GND',
          P4: '{{name}}_led_in',
          P2: '{{name}}_led_out',
        },
      });
    }
  }
  return result;
}
export function applyKeyDefaults(source: string, id: string): string {
  const item = readStudio(source).layout.objects?.[id];
  if (item?.kind !== 'key') {
    return source;
  }
  const options = keyOptions(source, item.cluster, item.cell?.[0]);
  let result = setLayout(
    source,
    'objects',
    id,
    ['envelopes', 'keycap', 'size'],
    options.size
  );
  const setup = keySetup(source, id);
  result = setup
    ? applyAssembly(result, [id], setup, 'preserve')
    : keyElectronics(result, id, options);
  return result;
}
