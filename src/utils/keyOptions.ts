import { getValue, setValue, removeValue, readStudio } from './studioSource';
import { setLayout } from './layoutSource';

export interface KeyOptions {
  size: (number | string)[];
  pitch: (number | string)[];
  diode: boolean;
  led: boolean;
  diodeAt: number[];
  ledAt: number[];
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
  return {
    ...DEFAULT_KEY_OPTIONS,
    ...((getValue(source, [
      'meta',
      'studio',
      'defaults',
    ]) as Partial<KeyOptions>) || {}),
    ...((getValue(source, [
      'meta',
      'studio',
      'layouts',
      cluster,
    ]) as Partial<KeyOptions>) || {}),
    ...((getValue(source, [
      'meta',
      'studio',
      'columns',
      cluster,
      column,
    ]) as Partial<KeyOptions>) || {}),
  };
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
  result = keyElectronics(result, id, options);
  return result;
}
