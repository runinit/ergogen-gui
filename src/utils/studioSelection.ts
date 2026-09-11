import type { LayoutReport } from 'ergogen/src/native';
import {
  includesObject,
  targets,
  movingTargets,
  type StudioSelection,
} from './studioTargets';
import { readStudio, getValue, setValue, moveColumn } from './studioSource';
import { moveLayout, setLayout } from './layoutSource';
import { resizeKey, KeyAlignment } from './keyResize';

export function selectedKeys(
  source: string,
  selection: StudioSelection
): string[] {
  return Object.entries(readStudio(source).layout.objects || {})
    .filter(
      ([id, item]) =>
        item.kind === 'key' &&
        includesObject(selection, {
          id,
          cluster: item.cluster,
          cell: item.cell,
        })
    )
    .map(([id]) => id);
}
export function sizeSelection(
  source: string,
  selection: StudioSelection,
  size?: (number | string)[],
  alignment?: Partial<KeyAlignment>,
  report?: LayoutReport
): string {
  let result = source;
  for (const id of selectedKeys(source, selection)) {
    const data = readStudio(result),
      item = data.layout.objects![id];
    const current = item.envelopes?.keycap?.size ||
      data.parts?.[item.part || '']?.envelopes?.keycap?.size || [18, 18];
    const prior = (item.properties?.key_alignment as KeyAlignment) || {
      x: 'auto',
      y: 'top',
    };
    result = resizeKey(
      result,
      id,
      size || current,
      report,
      alignment ? { ...prior, ...alignment } : undefined
    );
  }
  for (const target of targets(selection)) {
    if (size && target.section === 'clusters') {
      result = setValue(
        result,
        ['meta', 'studio', 'layouts', target.id, 'size'],
        size
      );
    }
    if (size && target.section === 'columns') {
      result = setValue(
        result,
        ['meta', 'studio', 'columns', target.cluster || '', target.id, 'size'],
        size
      );
    }
  }
  return result;
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const add = (before: unknown, delta: number) =>
  typeof before === 'string'
    ? `(${before}) + ${delta}`
    : Number(before || 0) + delta;
export function adjustSelection(
  source: string,
  selection: StudioSelection,
  offset: number[],
  rotation: number,
  stagger = 0
): string {
  if (![...offset, rotation, stagger].every(Number.isFinite)) {
    throw new Error('Enter numeric relative adjustments.');
  }
  const members = movingTargets(source, selection);
  if (members.length > 1 || selection.members) {
    return members.reduce(
      (current, member) =>
        adjustSelection(current, member, offset, rotation, stagger),
      source
    );
  }
  let result = source;
  const column = selection.section === 'columns';
  const section = column ? 'clusters' : selection.section;
  if (section !== 'clusters' && section !== 'objects') {
    return result;
  }
  const id = column ? selection.cluster || '' : selection.id;
  if (offset.some((value) => value !== 0)) {
    result = column
      ? moveColumn(result, id, selection.id, offset, IDENTITY)
      : moveLayout(result, section, id, offset);
  }
  if (rotation) {
    const path = column
      ? ['arrangement', 'splay', selection.id]
      : ['placement', 'override', 'rotate'];
    result = setLayout(
      result,
      section,
      id,
      path,
      add(getValue(result, ['layout', section, id, ...path]), rotation)
    );
  }
  if (stagger && column) {
    const path = ['arrangement', 'stagger', selection.id];
    result = setLayout(
      result,
      'clusters',
      id,
      path,
      add(getValue(result, ['layout', 'clusters', id, ...path]), stagger)
    );
  }
  return result;
}
