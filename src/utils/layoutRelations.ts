import { resolve } from 'ergogen/src/native/layout';
import type { LayoutReport } from 'ergogen/src/native';
import {
  getValue,
  readStudio,
  removeValue,
  setValue,
  nextId,
} from './studioSource';
import { moveTargets } from './studioMove';

export function alignObject(
  source: string,
  id: string,
  target: string,
  axis: 'x' | 'y',
  report: LayoutReport
): string {
  const data = readStudio(source),
    item = data.layout.objects?.[id];
  if (!item || report.objects[id]?.locked) {
    throw new Error('Select an unlocked object to align.');
  }
  const guide = report.guides?.[target];
  if (!guide || guide.members.includes(id)) {
    throw new Error('Choose a different alignment target.');
  }
  const depends = (members: string[], seen = new Set<string>()): boolean =>
    members.some((member) => {
      if (member === id) {
        return true;
      }
      if (seen.has(member)) {
        return false;
      }
      seen.add(member);
      const refs = Object.values(data.layout.constraints || {})
        .filter(
          (rule) =>
            rule.type === 'aligned' && rule.refs[0] === `${member}.center`
        )
        .flatMap((rule) => report.guides?.[rule.refs[1]]?.members || []);
      const parent = data.layout.objects?.[member]?.placement?.ref
        ?.replace(/^objects\./, '')
        .split('.')[0];
      return depends(parent ? [...refs, parent] : refs, seen);
    });
  if (depends(guide.members)) {
    throw new Error('This alignment would create a dependency cycle.');
  }
  const existing = Object.values(data.layout.constraints || {}).some(
    (rule) =>
      rule.type === 'aligned' &&
      rule.refs[0] === `${id}.center` &&
      rule.refs[1] === target &&
      rule.axis === axis
  );
  if (existing) {
    return source;
  }
  const name = nextId(Object.keys(data.layout.constraints || {}), 'alignment');
  const solve = item.placement?.solve || [];
  const added = ['x', 'y'].filter((value) => !solve.includes(value));
  source = setValue(
    source,
    ['layout', 'objects', id, 'placement', 'solve'],
    Array.from(new Set([...solve, ...added]))
  );
  source = setValue(source, ['layout', 'constraints', name], {
    type: 'aligned',
    refs: [`${id}.center`, target],
    axis,
    label: `${item.label || id} centered on ${guide.label}`,
  });
  return setValue(source, ['meta', 'studio', 'relations', name], {
    object: id,
    added,
  });
}

type Owner = { object: string; added: string[] };
type Ownership = { object?: string; added?: string[]; owners?: Owner[] };
const ownersOf = (value: Ownership): Owner[] =>
  value.owners ||
  (value.object ? [{ object: value.object, added: value.added || [] }] : []);

export function unlinkRelation(
  source: string,
  name: string,
  report: LayoutReport
): string {
  const owned = getValue(source, ['meta', 'studio', 'relations', name]) as
    | Ownership
    | undefined;
  let next = removeValue(source, ['layout', 'constraints', name]);
  if (!owned) {
    return next;
  }
  next = removeValue(next, ['meta', 'studio', 'relations', name]);
  for (const owner of ownersOf(owned)) {
    const remaining = (getValue(next, ['meta', 'studio', 'relations']) ||
      {}) as Record<string, Ownership>;
    const dependent = Object.entries(remaining).find(([, value]) =>
      ownersOf(value).some((item) => item.object === owner.object)
    );
    if (dependent) {
      const owners = ownersOf(dependent[1]).map((item) =>
        item.object === owner.object
          ? {
              ...item,
              added: Array.from(new Set([...item.added, ...owner.added])),
            }
          : item
      );
      next = setValue(next, ['meta', 'studio', 'relations', dependent[0]], {
        owners,
      });
      continue;
    }
    const current = report.objects[owner.object];
    if (!current) {
      continue;
    }
    // Bake the solved pose; remove only freedoms owned by the released relationship.
    const nominal = resolve(readStudio(next)).objects[owner.object];
    next = moveTargets(
      next,
      { section: 'objects', id: owner.object },
      current.position.map((v, i) => v - nominal.position[i]),
      report
    );
    const data = readStudio(next);
    const referenced = Object.values(data.layout.constraints || {}).some(
      (rule) =>
        rule.refs.some(
          (ref) => ref.replace(/^objects\./, '').split('.')[0] === owner.object
        )
    );
    if (referenced) {
      continue;
    }
    const solve = data.layout.objects?.[owner.object].placement?.solve || [];
    next = setValue(
      next,
      ['layout', 'objects', owner.object, 'placement', 'solve'],
      solve.filter((axis) => !owner.added.includes(axis))
    );
  }
  return next;
}
