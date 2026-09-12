import { mathnum } from 'ergogen/src/assert';
import { getValue, readStudio, setValue } from './studioSource';

export type Dimension = number | string;
export const UNIT_STEPS = [1, 0.5, 0.25, 0.125] as const;
export const DEFAULT_STEP = 0.25;
const DEFAULT_PITCH = 19;
export const formatDimension = (value: number) => Number(value.toFixed(6));

export function dimension(
  value: Dimension,
  units: Record<string, number>
): number {
  if (typeof value === 'string' && !value.trim()) {
    throw new Error('Enter a distance or expression.');
  }
  const result = mathnum(value)(units);
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Enter a finite distance or expression.');
  }
  return result;
}

// Resolve the same expressions as the native engine, without generating geometry.
export function pitchUnits(source: string): Record<string, number> {
  const data = readStudio(source);
  const values: Record<string, number> = {};
  const active = new Set<string>();
  const resolve = (name: string): number => {
    if (name in values) {
      return values[name];
    }
    if (active.has(name)) {
      throw new Error(`Cyclic parameter: ${name}`);
    }
    active.add(name);
    const expression = data.units?.[name];
    for (const symbol of String(expression).match(/[A-Za-z_][A-Za-z_0-9]*/g) ||
      []) {
      if (symbol in (data.units || {})) {
        resolve(symbol);
      }
    }
    values[name] = dimension(expression!, values);
    active.delete(name);
    return values[name];
  };
  Object.keys(data.units || {}).forEach(resolve);
  const setup = getValue(source, ['meta', 'studio', 'setup']) as
    | { pitch?: number; pitchY?: number }
    | undefined;
  const defaults = getValue(source, ['meta', 'studio', 'defaults', 'pitch']) as
    | Dimension[]
    | undefined;
  const cluster = Object.values(data.layout.clusters || {}).find(
    (item) => item.arrangement?.pitch
  );
  const pitch = defaults ||
    cluster?.arrangement?.pitch || [
      setup?.pitch || DEFAULT_PITCH,
      setup?.pitchY || setup?.pitch || DEFAULT_PITCH,
    ];
  if (!('u' in values)) {
    values.u = dimension(pitch[0], values);
  }
  if (!('v' in values)) {
    values.v = dimension(pitch[1], values);
  }
  return values;
}

export function ensurePitchUnits(source: string): string {
  const units = pitchUnits(source);
  for (const name of ['u', 'v']) {
    if (getValue(source, ['units', name]) === undefined) {
      source = setValue(
        source,
        ['units', name],
        name === 'v' && units.v === units.u ? 'u' : units[name]
      );
    }
  }
  return source;
}

export function dimensionValue(text: string): Dimension {
  const value = text.trim();
  return value && Number.isFinite(Number(value)) ? Number(value) : value;
}

export function addDimension(value: unknown, delta: number): Dimension {
  if (!delta) {
    return (value ?? 0) as Dimension;
  }
  return typeof value === 'string'
    ? `(${value}) + ${formatDimension(delta)}`
    : formatDimension(Number(value || 0) + delta);
}
