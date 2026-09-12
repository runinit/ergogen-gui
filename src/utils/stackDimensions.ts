import { getValue, setValue } from './studioSource';
import type { StackupSpec } from '../types/stackup';

export function setStackDimension(
  source: string,
  path: (string | number)[],
  value: unknown
): string {
  const current = getValue(source, path);
  const parameter =
    typeof current === 'string' &&
    /^[A-Za-z_]\w*$/.test(current) &&
    getValue(source, ['units', current]) !== undefined;
  return setValue(
    source,
    parameter ? ['units', current as string] : path,
    value
  );
}
export function stackForBoard(
  source: string,
  board: string
): string | undefined {
  const stacks = (getValue(source, ['designs', 'stackups']) || {}) as Record<
    string,
    StackupSpec
  >;
  return Object.keys(stacks).find((name) => stacks[name].pcb === board);
}
