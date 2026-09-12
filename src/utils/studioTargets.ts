import type { ResolvedObject } from 'ergogen/src/native';
import { readStudio } from './studioSource';

export interface StudioTarget {
  section:
    | 'objects'
    | 'columns'
    | 'clusters'
    | 'parameters'
    | 'constraints'
    | 'outline'
    | 'layers';
  id: string;
  cluster?: string;
}
export interface StudioSelection extends StudioTarget {
  members?: StudioTarget[];
  anchor?: StudioTarget;
}
export type SelectionMode = 'replace' | 'toggle' | 'range';
const targetKey = (item: StudioTarget) =>
  `${item.section}:${item.cluster || ''}:${item.id}`;
export const targets = (selection: StudioSelection): StudioTarget[] =>
  selection.members ||
  (selection.id
    ? [
        {
          section: selection.section,
          id: selection.id,
          ...(selection.cluster ? { cluster: selection.cluster } : {}),
        },
      ]
    : []);
export const sameTarget = (a: StudioTarget, b: StudioTarget) =>
  targetKey(a) === targetKey(b);
export function selectionMode(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): SelectionMode {
  return event.shiftKey
    ? 'range'
    : event.ctrlKey || event.metaKey
      ? 'toggle'
      : 'replace';
}
export function selectTargets(
  current: StudioSelection,
  next: StudioSelection,
  mode: SelectionMode,
  order: StudioTarget[] = []
): StudioSelection {
  if (mode === 'replace') {
    return next;
  }
  const anchor = current.anchor || targets(current)[0] || next;
  let members = targets(current);
  if (mode === 'toggle') {
    members = members.some((item) => sameTarget(item, next))
      ? members.filter((item) => !sameTarget(item, next))
      : [...members, next];
  } else {
    const start = order.findIndex((item) => sameTarget(item, anchor));
    const end = order.findIndex((item) => sameTarget(item, next));
    members =
      start < 0 || end < 0
        ? [...members.filter((item) => !sameTarget(item, next)), next]
        : order.slice(Math.min(start, end), Math.max(start, end) + 1);
  }
  const primary =
    members.find((item) => sameTarget(item, next)) || members.at(-1);
  if (!primary) {
    return { section: 'objects', id: '' };
  }
  return members.length === 1
    ? { ...primary, anchor }
    : { ...primary, members, anchor };
}
export function includesObject(
  selection: StudioSelection,
  item: Pick<ResolvedObject, 'id' | 'cluster' | 'cell'>
) {
  return targets(selection).some((target) =>
    target.section === 'objects'
      ? target.id === item.id
      : target.section === 'clusters'
        ? target.id === item.cluster
        : target.section === 'columns' &&
          target.cluster === item.cluster &&
          target.id === item.cell?.[0]
  );
}

// Moving an ancestor already moves its descendants. Never add the delta twice.
export function movingTargets(
  source: string,
  selection: StudioSelection
): StudioTarget[] {
  const { layout } = readStudio(source);
  const selected = targets(selection).filter((item) =>
    ['objects', 'columns', 'clusters'].includes(item.section)
  );
  const parents = (item: StudioTarget): StudioTarget[] => {
    if (item.section === 'columns') {
      return [{ section: 'clusters', id: item.cluster || '' }];
    }
    const spec =
      item.section === 'objects'
        ? layout.objects?.[item.id]
        : layout.clusters?.[item.id];
    if (!spec) {
      // Mirrored members are virtual, but still belong to their mirrored frame.
      for (const [cluster, value] of Object.entries(layout.clusters || {})) {
        if (
          item.section !== 'objects' ||
          !value.mirror ||
          !item.id.startsWith(`${cluster}__`)
        ) {
          continue;
        }
        const member = layout.objects?.[item.id.slice(cluster.length + 2)];
        if (member?.cluster !== value.mirror.source) {
          continue;
        }
        const ref = member.placement?.ref
          ?.replace(/^objects\./, '')
          .split('.')[0];
        if (ref && layout.objects?.[ref]?.cluster === value.mirror.source) {
          return [{ section: 'objects', id: `${cluster}__${ref}` }];
        }
        return member.cell
          ? [{ section: 'columns', cluster, id: member.cell[0] }]
          : [{ section: 'clusters', id: cluster }];
      }
      return [];
    }
    const result: StudioTarget[] = [];
    if (spec.placement?.ref) {
      const ref = spec.placement.ref
        .replace(/^objects\./, '')
        .replace(/\.origin$/, '');
      result.push(
        ref.startsWith('clusters.')
          ? { section: 'clusters', id: ref.slice(9) }
          : { section: 'objects', id: ref.split('.')[0] }
      );
    } else if (spec.cluster) {
      result.push(
        spec.cell
          ? { section: 'columns', cluster: spec.cluster, id: spec.cell[0] }
          : { section: 'clusters', id: spec.cluster }
      );
    }
    return result;
  };
  return selected.filter((item) => {
    const queue = parents(item),
      seen = new Set<string>();
    while (queue.length) {
      const parent = queue.shift()!;
      const key = targetKey(parent);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (selected.some((other) => sameTarget(other, parent))) {
        return false;
      }
      queue.push(...parents(parent));
    }
    return true;
  });
}
