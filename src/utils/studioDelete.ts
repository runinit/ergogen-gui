import {
  readStudio,
  removeObject,
  resizeCluster,
  removeValue,
} from './studioSource';
import { targets, type StudioSelection } from './studioTargets';

export function isDeleteShortcut(
  key: string,
  target: EventTarget | null
): boolean {
  return (
    key === 'Delete' &&
    target instanceof Element &&
    !target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], .monaco-editor'
    )
  );
}
// Build the complete edit before publishing it; references and locks remain enforced.
export function removeSelection(
  source: string,
  selection: StudioSelection
): string {
  const { layout } = readStudio(source);
  const selected = targets(selection);
  const columns = selected.filter((item) => item.section === 'columns');
  const pending = selected.flatMap((item) => {
    if (item.section === 'objects' || item.section === 'clusters') {
      return [{ section: item.section, id: item.id }];
    }
    if (item.section !== 'columns') {
      throw new Error('Select objects, columns or matrices to delete.');
    }
    const cluster = layout.clusters?.[item.cluster || ''];
    if (!cluster || cluster.locked || cluster.mirror) {
      throw new Error('Unlock and select an authored column.');
    }
    return Object.entries(layout.objects || {})
      .filter(
        ([, spec]) =>
          spec.cluster === item.cluster && spec.cell?.[0] === item.id
      )
      .map(([id]) => ({ section: 'objects' as const, id }));
  });
  let result = source;
  // Selected dependents may refer to each other. Remove leaves before parents.
  while (pending.length) {
    let changed = false;
    let failure: unknown;
    for (let index = pending.length - 1; index >= 0; index--) {
      const item = pending[index];
      if (!readStudio(result).layout[item.section]?.[item.id]) {
        if (!layout[item.section]?.[item.id]) {
          throw new Error('Select an authored object.');
        }
        pending.splice(index, 1);
        changed = true;
        continue;
      }
      try {
        result = removeObject(result, item.section, item.id);
        pending.splice(index, 1);
        changed = true;
      } catch (error) {
        failure = error;
      }
    }
    if (!changed) {
      throw failure;
    }
  }
  for (const id of Array.from(
    new Set(columns.map((item) => item.cluster || ''))
  )) {
    const cluster = readStudio(result).layout.clusters?.[id];
    if (!cluster) {
      continue;
    }
    const removed = columns
      .filter((item) => item.cluster === id)
      .map((item) => item.id);
    const keep = (cluster.arrangement?.columns || []).filter(
      (column) => !removed.includes(column)
    );
    result = keep.length
      ? resizeCluster(result, id, { columns: keep })
      : removeObject(result, 'clusters', id);
    for (const column of removed) {
      result = removeValue(result, ['meta', 'studio', 'columns', id, column]);
    }
  }
  return result;
}
