import { hasSpacing, layoutSpacing } from './snapSpacing';
import { resolve } from 'ergogen/src/native/layout';
import { clearResizeSpacing, spaceResizedKeys } from './resizeSpacing';
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
  const keys = selectedKeys(source, selection);
  const initial = readStudio(source);
  const clusters = Array.from(
    new Set(
      keys
        .map((id) => initial.layout.objects![id].cluster)
        .filter((id): id is string => !!id)
    )
  );
  if (
    keys.some(
      (id) =>
        initial.layout.objects![id].locked ||
        initial.layout.clusters?.[initial.layout.objects![id].cluster || '']
          ?.locked ||
        report?.objects[id]?.locked
    )
  ) {
    throw new Error('This object is locked.');
  }
  const original = resolve(initial);
  let result = clearResizeSpacing(source, clusters);
  const draft = resolve(readStudio(result));
  for (const id of keys) {
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
      draft,
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
  result = spaceResizedKeys(result, clusters, original);
  const checked = resolve(readStudio(result));
  if (
    Object.values(original.objects).some(
      (item) =>
        item.locked &&
        JSON.stringify(item.matrix) !==
          JSON.stringify(checked.objects[item.id]?.matrix)
    )
  ) {
    throw new Error('Resizing would move a locked attachment or mirror.');
  }
  const spacing = layoutSpacing(result, checked);
  for (const id of keys.filter(
    (key) =>
      initial.layout.clusters?.[initial.layout.objects![key].cluster || '']
        ?.arrangement?.type !== 'columns'
  )) {
    result = setValue(
      result,
      ['meta', 'studio', 'resizeSpacing', `object:${id}`],
      {
        edits: [],
        conflicts: hasSpacing(checked, [id], [0, 0], 0, spacing)
          ? []
          : [
              `Keycap clearance remains unresolved for ${id}. Move nearby objects before exporting.`,
            ],
      }
    );
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
