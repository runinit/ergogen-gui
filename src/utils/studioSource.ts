import { initBoardOutlines } from './boardOutlines';
import { syncBoardTopology } from './boardTopology';
import { syncAssemblySupport } from './assemblySupport';
import { reviewResize } from './resizeReview';
import { addDimension } from './designUnits';
import { syncAssemblyMirrors } from './assemblyMirrors';
import { syncControllerNets } from './assemblyNets';
import { syncLedChains } from './assemblyWiring';
import type { LayoutReport } from 'ergogen/src/native';
import { isMap, isScalar, isNode, parseDocument } from 'yaml';
import { sourceDocument, sourceValue } from './sourceSnapshot';
import { editField as setValue, SourcePath } from './designSource';
export { editField as setValue } from './designSource';
import { LayoutSection, setLayout } from './layoutSource';
import { applyKeyDefaults, keyOptions } from './keyOptions';

type Arrangement = 'free' | 'columns' | 'arc';
export interface StudioItem {
  kind?: 'key' | 'component' | 'mount' | 'anchor';
  label?: string;
  part?: string;
  cluster?: string;
  layer?: string;
  pcb?: string;
  locked?: boolean;
  cell?: string[];
  index?: number;
  placement?: {
    at?: (number | string)[];
    rotate?: number | string;
    ref?: string;
    above?: string;
    below?: string;
    gap?: number | string;
    solve?: string[];
  };
  arrangement?: {
    type: Arrangement;
    columns?: string[];
    rows?: string[];
    pitch?: (number | string)[];
    radius?: number | string;
    start?: number | string;
    step?: number | string;
  };
  mirror?: { source: string; axis: number | string };
  envelopes?: Record<
    string,
    {
      size?: (number | string)[];
      height?: (number | string)[];
      at?: (number | string)[];
      rotate?: number | string;
    }
  >;
  properties?: Record<string, unknown>;
  footprints?: Record<string, unknown>;
}
export interface StudioRule {
  type: string;
  refs: string[];
  value?: number | string;
  axis?: 'x' | 'y';
  label?: string;
}
export interface StudioDoc {
  schema: string;
  units?: Record<string, number | string>;
  parts?: Record<string, StudioItem>;
  layout: {
    objects?: Record<string, StudioItem>;
    clusters?: Record<string, StudioItem>;
    layers?: Record<string, { surface?: string; assembly?: string }>;
    constraints?: Record<string, StudioRule>;
  };
  designs?: {
    regions?: Record<string, unknown>;
    profiles?: Record<string, Record<string, unknown>>;
    boundaries?: Record<string, unknown>;
    assemblies?: Record<string, unknown>;
  };
  pcbs?: Record<string, { profile?: string; thickness?: number | string }>;
}
export function readStudio(source: string): StudioDoc {
  const data = sourceValue(source) as StudioDoc;
  if (data?.schema !== 'ergogen/v1' || !data.layout) {
    throw new Error('Open a native ergogen/v1 project.');
  }
  return data as StudioDoc;
}
export function getValue(source: string, path: SourcePath): unknown {
  return sourceValue(source, path);
}
export function removeValue(source: string, path: SourcePath): string {
  const doc = sourceDocument(source);
  if (doc.errors.length) {
    throw new Error(doc.errors[0].message);
  }
  if (doc.getIn(path, true) === undefined) {
    return source;
  }
  const parent = doc.getIn(path.slice(0, -1), true);
  if (!isMap(parent)) {
    throw new Error('Remove a named field from a mapping.');
  }
  const index = parent.items.findIndex(
    (item) => isScalar(item.key) && item.key.value === path.at(-1)
  );
  if (index < 0) {
    return source;
  }
  const entry = parent.items[index];
  if (
    !isScalar(entry.key) ||
    !entry.key.range ||
    !isNode(entry.value) ||
    !entry.value.range
  ) {
    throw new Error('This field has no editable source range.');
  }
  let start = entry.key.range[0],
    end = entry.value.range[2];
  if (parent.items.length === 1) {
    return setValue(source, path.slice(0, -1), {});
  }
  if (parent.flow) {
    end = entry.value.range[1];
    const next = parent.items[index + 1]?.key;
    if (isScalar(next) && next.range) {
      end = next.range[0];
    } else {
      start = source.lastIndexOf(',', start);
    }
  } else {
    start = source.lastIndexOf('\n', start - 1) + 1;
  }
  const result = source.slice(0, start) + source.slice(end);
  const check = parseDocument(result);
  if (check.errors.length) {
    throw new Error(check.errors[0].message);
  }
  // toJS catches dangling YAML aliases before committing a deletion.
  check.toJS();
  return result;
}
export function nextId(ids: string[], base: string): string {
  const prefix =
    base.replace(/[^A-Za-z_0-9-]/g, '_').replace(/^[^A-Za-z_]/, '_$&') ||
    'item';
  let id = prefix,
    index = 2;
  while (ids.includes(id)) {
    id = `${prefix}_${index++}`;
  }
  return id;
}
function vacant(source: string, path: SourcePath) {
  if (getValue(source, path) !== undefined) {
    throw new Error('Choose a new, unique name.');
  }
  if (!/^[A-Za-z_][A-Za-z_0-9-]*$/.test(String(path.at(-1)))) {
    throw new Error(
      'Use letters, numbers, underscores or hyphens; start with a letter.'
    );
  }
}
function keyPart(source: string): [string, string] {
  const data = readStudio(source);
  const part =
    Object.values(data.layout.objects || {}).find(
      (item) => item.kind === 'key' && item.part
    )?.part ||
    Object.keys(data.parts || {}).find(
      (id) => data.parts?.[id].envelopes?.plate
    );
  if (part) {
    return [source, part];
  }
  const id = nextId(Object.keys(data.parts || {}), 'mx');
  return [
    setValue(source, ['parts', id], {
      revision: '1',
      envelopes: {
        pcb: { size: [18, 18] },
        plate: { size: [14, 14] },
        keycap: { size: [18, 18] },
      },
      footprints: {
        switch: {
          what: 'mx',
          params: { from: '{{column_net}}', to: '{{row_net}}' },
        },
      },
    }),
    id,
  ];
}
function pcbLayer(data: StudioDoc, pcb?: string): string | undefined {
  return Object.entries(data.layout.layers || {}).find(
    ([, layer]) => layer.surface === `pcb.${pcb}.top`
  )?.[0];
}
export function addObject(
  source: string,
  id: string,
  kind: NonNullable<StudioItem['kind']>,
  cluster?: string,
  defaults: 'apply' | 'defer' = 'apply'
): string {
  vacant(source, ['layout', 'objects', id]);
  const data = readStudio(source),
    item: StudioItem = { kind, label: id };
  let result = source;
  if (kind === 'key') {
    const [next, part] = keyPart(result);
    result = next;
    item.part = part;
  } else if (kind !== 'anchor') {
    item.envelopes = { body: { size: [10, 10] }, pcb: { size: [10, 10] } };
  }
  const pcb =
    data.layout.layers?.[
      data.layout.clusters?.[cluster || '']?.layer || ''
    ]?.surface?.match(/^pcb\.(.+)\.top$/)?.[1] ||
    Object.keys(data.pcbs || {})[0];
  if (pcb && kind !== 'anchor') {
    item.pcb = pcb;
    if (!cluster) {
      item.layer = pcbLayer(data, pcb);
    }
  }
  if (cluster) {
    const spec = data.layout.clusters?.[cluster];
    if (!spec || spec.locked || spec.mirror) {
      throw new Error('Choose an unlocked source cluster.');
    }
    item.cluster = cluster;
    if (spec.arrangement?.type === 'columns') {
      const used = new Set(
        Object.values(data.layout.objects || {})
          .filter((item) => item.cluster === cluster)
          .map((item) => JSON.stringify(item.cell))
      );
      const cell = (spec.arrangement.columns || [])
        .flatMap((col) =>
          (spec.arrangement!.rows || []).map((row) => [col, row])
        )
        .find((cell) => !used.has(JSON.stringify(cell)));
      if (!cell) {
        throw new Error('Add a row or column, or choose a free cluster.');
      }
      item.cell = cell;
    }
    if (spec.arrangement?.type === 'arc') {
      item.index =
        Math.max(
          -1,
          ...Object.values(data.layout.objects || {})
            .filter((item) => item.cluster === cluster)
            .map((item) => item.index ?? -1)
        ) + 1;
    }
  }
  result = setValue(result, ['layout', 'objects', id], item);
  if (defaults === 'defer') {
    return result;
  }
  return initBoardOutlines(
    kind === 'key' ? applyKeyDefaults(result, id) : result
  );
}
export function addCluster(
  source: string,
  id: string,
  type: Arrangement,
  size = { columns: 1, rows: 1 }
): string {
  vacant(source, ['layout', 'clusters', id]);
  let result = source;
  if (
    type === 'columns' &&
    getValue(result, ['units', 'pitch']) === undefined
  ) {
    result = setValue(result, ['units', 'pitch'], 19);
  }
  const arrangement =
    type === 'columns'
      ? {
          type,
          columns: ['c1'],
          rows: ['r1'],
          pitch:
            getValue(result, ['meta', 'studio', 'defaults', 'pitch']) ||
            getValue(result, ['meta', 'studio', 'setup'])
              ? keyOptions(result).pitch
              : ['pitch', 'pitch'],
        }
      : type === 'arc'
        ? { type, radius: 45, start: -15, step: 30 }
        : { type };
  const data = readStudio(result);
  const layer = pcbLayer(data, Object.keys(data.pcbs || {})[0]);
  result = setValue(result, ['layout', 'clusters', id], {
    label: id,
    arrangement,
    ...(layer ? { layer } : {}),
  });
  if (type === 'free') {
    return syncBoardTopology(result);
  }
  return syncBoardTopology(
    resizeCluster(
      result,
      id,
      type === 'arc'
        ? { count: 3 }
        : {
            columns: matrixNames([], size.columns, 'c'),
            rows: matrixNames([], size.rows, 'r'),
          },
      'fill'
    )
  );
}
export function createMatrix(
  source: string,
  columns: number,
  rows: number
): string {
  let result = setValue(source, ['layout'], { objects: {} });
  result = setValue(result, ['designs'], {});
  result = setValue(result, ['meta', 'name'], 'Keyboard');
  const parts = readStudio(result).parts || {};
  for (const [id, part] of Object.entries(parts)) {
    if (!part.envelopes?.keycap && part.envelopes?.pcb?.size) {
      result = setValue(result, ['parts', id, 'envelopes', 'keycap'], {
        size: part.envelopes.pcb.size,
      });
    }
  }
  result = addCluster(result, 'fingers', 'columns', { columns, rows });
  result = addOutline(result);
  result = setValue(result, ['layout', 'layers', 'electronics'], {
    surface: 'pcb.main.top',
  });
  return setValue(
    result,
    ['layout', 'clusters', 'fingers', 'layer'],
    'electronics'
  );
}

export function matrixNames(
  before: string[],
  count: number,
  prefix: string
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('Use 1–100 rows or columns.');
  }
  const names = before.slice(0, count);
  while (names.length < count) {
    names.push(nextId(names, `${prefix}${names.length + 1}`));
  }
  return names;
}
export function addCell(
  source: string,
  cluster: string,
  column: string,
  row: string
): string {
  const data = readStudio(source),
    spec = data.layout.clusters?.[cluster];
  if (
    !spec ||
    spec.locked ||
    !spec.arrangement?.columns?.includes(column) ||
    !spec.arrangement.rows?.includes(row)
  ) {
    throw new Error('Choose an unlocked matrix cell.');
  }
  if (
    Object.values(data.layout.objects || {}).some(
      (item) =>
        item.cluster === cluster &&
        item.cell?.[0] === column &&
        item.cell[1] === row
    )
  ) {
    throw new Error('This cell already has a key.');
  }
  const id = nextId(
    Object.keys(data.layout.objects || {}),
    `${cluster}_${column}_${row}`
  );
  let next = addObject(source, id, 'key', undefined, 'defer');
  next = setValue(next, ['layout', 'objects', id, 'cluster'], cluster);
  next = setValue(next, ['layout', 'objects', id, 'cell'], [column, row]);
  return applyKeyDefaults(next, id);
}
export function moveColumn(
  source: string,
  cluster: string,
  column: string,
  delta: number[],
  frame: number[]
): string {
  const path = ['arrangement', 'offsets', column];
  const current = (getValue(source, [
    'layout',
    'clusters',
    cluster,
    ...path,
  ]) || [0, 0, 0]) as (number | string)[];
  const local = [0, 1, 2].map(
    (axis) =>
      Math.round(
        delta.reduce((sum, v, row) => sum + v * frame[row * 4 + axis], 0) * 1e6
      ) / 1e6
  );
  // Vertical column movement is stagger; keep authored offsets independent.
  if (local[1]) {
    const stagger = ['arrangement', 'stagger', column];
    source = setLayout(
      source,
      'clusters',
      cluster,
      stagger,
      addDimension(
        getValue(source, ['layout', 'clusters', cluster, ...stagger]),
        local[1]
      )
    );
  }
  if (!local[0] && !local[2]) {
    return source;
  }
  return setLayout(
    source,
    'clusters',
    cluster,
    path,
    current.map((value, i) => (i === 1 ? value : addDimension(value, local[i])))
  );
}

function clearAutoBridges(
  source: string,
  targets: { section: LayoutSection; id: string }[]
): string {
  const owned = (getValue(source, ['meta', 'studio', 'bridges']) ||
    {}) as Record<string, string[]>;
  const usesTarget = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return targets.some((target) =>
        [target.id, `${target.section}.${target.id}`].some(
          (ref) => value === ref || value.startsWith(`${ref}.`)
        )
      );
    }
    return (
      !!value &&
      typeof value === 'object' &&
      Object.values(value).some(usesTarget)
    );
  };
  let result = source;
  for (const [boundary, ids] of Object.entries(owned)) {
    const removed = ids.filter((id) =>
      usesTarget(
        getValue(result, ['designs', 'boundaries', boundary, 'bridges', id])
      )
    );
    for (const id of removed) {
      result = removeValue(result, [
        'designs',
        'boundaries',
        boundary,
        'bridges',
        id,
      ]);
    }
    if (removed.length) {
      result = setValue(
        result,
        ['meta', 'studio', 'bridges', boundary],
        ids.filter((id) => !removed.includes(id))
      );
    }
  }
  return result;
}
export function removeObject(
  source: string,
  section: LayoutSection,
  id: string
): string {
  const data = readStudio(source),
    item = data.layout[section]?.[id];
  if (!item) {
    throw new Error('Select an authored object.');
  }
  if (
    item.locked ||
    (item.cluster && data.layout.clusters?.[item.cluster]?.locked)
  ) {
    throw new Error('Unlock this object before deleting it.');
  }
  const members =
    section === 'clusters'
      ? Object.entries(data.layout.objects || {}).filter(
          ([, member]) => member.cluster === id
        )
      : [];
  // Owned electronics follow deletion of their key or matrix.
  const owners = new Set([id, ...members.map(([key]) => key)]);
  for (const [key, member] of Object.entries(data.layout.objects || {})) {
    if (
      typeof member.properties?.owner === 'string' &&
      owners.has(member.properties.owner)
    ) {
      if (!members.some(([existing]) => existing === key)) {
        members.push([key, member]);
      }
    }
  }
  if (members.some(([, member]) => member.locked)) {
    throw new Error('Unlock the cluster members before deleting it.');
  }
  const targets = [
    { section, id },
    ...members.map(([key]) => ({ section: 'objects' as const, id: key })),
  ];
  source = clearAutoBridges(source, targets);
  const removed = new Set(
    targets.map((target) => `layout.${target.section}.${target.id}`)
  );
  const references: string[] = [];
  const scan = (value: unknown, path: string[]) => {
    // Membership and links inside a deleted subtree are removed in the same edit.
    if (removed.has(path.join('.'))) {
      return;
    }
    if (typeof value === 'string') {
      if (
        targets.some((target) => {
          const ref =
            target.section === 'clusters' ? `clusters.${target.id}` : target.id;
          return (
            value === ref ||
            value.startsWith(`${ref}.`) ||
            value === `objects.${target.id}` ||
            value.startsWith(`objects.${target.id}.`) ||
            (target.section === 'clusters' &&
              ['cluster', 'source', 'ref'].includes(path.at(-1) || '') &&
              value === target.id)
          );
        })
      ) {
        references.push(path.join('.'));
      }
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([name, child]) =>
        scan(child, [...path, name])
      );
    }
  };
  scan(readStudio(source), []);
  if (references.length) {
    throw new Error(
      `Used by ${references.join(', ')}. Update these references first.`
    );
  }
  for (const target of targets) {
    if (target.section === 'objects') {
      source = removeValue(source, [
        'meta',
        'studio',
        'electronics',
        target.id,
      ]);
    } else {
      source = removeValue(source, ['meta', 'studio', 'layouts', target.id]);
      source = removeValue(source, ['meta', 'studio', 'columns', target.id]);
    }
  }
  const next = targets.reduce(
    (next, target) => removeValue(next, ['layout', target.section, target.id]),
    source
  );
  return syncControllerNets(
    syncAssemblySupport(
      syncAssemblyMirrors(source, syncLedChains(source, next))
    )
  );
}
export function resizeCluster(
  source: string,
  id: string,
  size: { columns?: string[]; rows?: string[]; count?: number },
  mode: 'resize' | 'fill' = 'resize'
): string {
  const data = readStudio(source),
    cluster = data.layout.clusters?.[id];
  if (!cluster || cluster.locked || cluster.mirror) {
    throw new Error('Choose an unlocked source cluster.');
  }
  const arc = cluster.arrangement?.type === 'arc';
  const columns = size.columns || cluster.arrangement?.columns || [],
    rows = size.rows || cluster.arrangement?.rows || [];
  if (
    (arc &&
      (!Number.isInteger(size.count) ||
        size.count! < 1 ||
        size.count! > 100)) ||
    (!arc &&
      (!columns.length ||
        !rows.length ||
        new Set(columns).size !== columns.length ||
        new Set(rows).size !== rows.length ||
        columns.length * rows.length > 500))
  ) {
    throw new Error('Use unique rows and columns, or 1–100 arc keys.');
  }
  const desired = arc
    ? Array.from({ length: size.count! }, (_, index) => String(index))
    : columns.flatMap((col) => rows.map((row) => JSON.stringify([col, row])));
  const members = Object.entries(data.layout.objects || {}).filter(
    ([, item]) => item.cluster === id && item.kind === 'key'
  );
  const memberKey = (item: StudioItem) =>
    arc ? String(item.index) : JSON.stringify(item.cell);
  let result = source;
  const removed: string[] = [];
  for (const [key, item] of members) {
    if (!desired.includes(memberKey(item))) {
      removed.push(key);
      result = removeObject(result, 'objects', key);
    }
  }
  if (!arc) {
    result = setValue(
      result,
      ['layout', 'clusters', id, 'arrangement', 'columns'],
      columns
    );
    result = setValue(
      result,
      ['layout', 'clusters', id, 'arrangement', 'rows'],
      rows
    );
  }
  for (const cell of desired) {
    const oldCell = arc ? [] : (JSON.parse(cell) as string[]);
    const hole =
      !arc &&
      mode === 'resize' &&
      cluster.arrangement?.columns?.includes(oldCell[0]) &&
      cluster.arrangement?.rows?.includes(oldCell[1]);
    if (members.some(([, item]) => memberKey(item) === cell) || hole) {
      continue;
    }
    const key = nextId(
      Object.keys(readStudio(result).layout.objects || {}),
      `${id}_${arc ? cell : (JSON.parse(cell) as string[]).join('_')}`
    );
    result = addObject(result, key, 'key', undefined, 'defer');
    result = setValue(result, ['layout', 'objects', key, 'cluster'], id);
    result = setValue(
      result,
      ['layout', 'objects', key, arc ? 'index' : 'cell'],
      arc ? Number(cell) : JSON.parse(cell)
    );
    const pcb =
      data.layout.layers?.[cluster.layer || '']?.surface?.match(
        /^pcb\.(.+)\.top$/
      )?.[1];
    if (pcb) {
      result = setValue(result, ['layout', 'objects', key, 'pcb'], pcb);
    }
    result = applyKeyDefaults(result, key);
  }
  return reviewResize(source, result, removed);
}
function copyBindings(item: StudioItem) {
  if (!item.footprints) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(item.footprints).flatMap(([id, value]) => {
      if (!value || typeof value !== 'object') {
        return [];
      }
      const { reference: _reference, ...binding } = value as Record<
        string,
        unknown
      >;
      return [[id, binding]];
    })
  );
}

function copyKeyRecipe(source: string, from: string, to: string): string {
  const document = readStudio(source);
  const original = document.layout.objects?.[from];
  const target = document.layout.objects?.[to];
  const rename = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (value === original?.properties?.row_net) {
        return target?.properties?.row_net || value;
      }
      if (value === original?.properties?.column_net) {
        return target?.properties?.column_net || value;
      }
      return value === from ||
        value.startsWith(`${from}_`) ||
        value.startsWith(`${from}.`)
        ? to + value.slice(from.length)
        : value;
    }
    if (Array.isArray(value)) {
      return value.map(rename);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, rename(item)])
      );
    }
    return value;
  };
  if (target?.footprints) {
    source = setValue(
      source,
      ['layout', 'objects', to, 'footprints'],
      rename(target.footprints)
    );
  }
  for (const item of Object.values(document.layout.objects || {})) {
    if (item.properties?.owner !== from) {
      continue;
    }
    const name = nextId(
      Object.keys(readStudio(source).layout.objects || {}),
      `${to}_${item.properties.role || 'component'}`
    );
    const child = rename({
      ...item,
      footprints: copyBindings(item),
    }) as StudioItem;
    // A copied free key no longer has a matrix cell; its children follow its ref.
    if (target?.cell) {
      child.cell = target.cell;
    } else {
      delete child.cell;
    }
    if (target?.cluster) {
      child.cluster = target.cluster;
    } else {
      delete child.cluster;
    }
    source = setValue(source, ['layout', 'objects', name], child);
  }
  const recipe = getValue(source, ['meta', 'studio', 'electronics', from]) as
    | Record<string, { switch?: Record<string, unknown> | null }>
    | undefined;
  if (!recipe) {
    return source;
  }
  const copy = JSON.parse(JSON.stringify(recipe));
  if (copy.diode?.switch) {
    delete copy.diode.switch.reference;
  }
  return setValue(source, ['meta', 'studio', 'electronics', to], copy);
}
export function duplicateObject(
  source: string,
  section: LayoutSection,
  id: string,
  next: string
): string {
  vacant(source, ['layout', section, next]);
  const data = readStudio(source),
    item = data.layout[section]?.[id];
  if (!item) {
    throw new Error('Select an authored object.');
  }
  if (section === 'clusters') {
    let result = setValue(source, ['layout', 'clusters', next], {
      ...item,
      label: next,
      locked: false,
    });
    for (const group of ['layouts', 'columns']) {
      const defaults = getValue(source, ['meta', 'studio', group, id]);
      if (defaults) {
        result = setValue(result, ['meta', 'studio', group, next], defaults);
      }
    }
    if (!item.mirror) {
      for (const [key, member] of Object.entries(data.layout.objects || {})) {
        if (member.cluster !== id || member.properties?.owner) {
          continue;
        }
        const copy = nextId(
          Object.keys(readStudio(result).layout.objects || {}),
          `${next}_${key}`
        );
        result = setValue(result, ['layout', 'objects', copy], {
          ...member,
          footprints: copyBindings(member),
          label: copy,
          cluster: next,
          properties:
            member.kind === 'key'
              ? {
                  ...member.properties,
                  column_net: member.cell
                    ? `${next}_${member.cell[0]}`
                    : `${copy}_column`,
                  row_net: member.cell
                    ? `${next}_${member.cell[1]}`
                    : `${next}_row`,
                }
              : member.properties,
        });
        result = copyKeyRecipe(result, key, copy);
      }
    }
    return syncControllerNets(
      syncAssemblyMirrors(
        source,
        syncLedChains(
          source,
          setLayout(
            result,
            section,
            next,
            ['placement', 'override', 'at'],
            [20, 0, 0]
          )
        )
      )
    );
  }
  const { cell: _cell, index: _index, cluster: _cluster, ...copy } = item;
  const result = setValue(source, ['layout', 'objects', next], {
    ...copy,
    footprints: copyBindings(item),
    label: next,
    locked: false,
    properties: {
      ...item.properties,
      column_net: `${next}_column`,
      row_net: `${next}_row`,
    },
    placement: { ref: id, at: [20, 0, 0] },
  });
  return syncControllerNets(
    syncAssemblyMirrors(
      source,
      syncLedChains(source, copyKeyRecipe(result, id, next))
    )
  );
}

export function addOutline(
  source: string,
  board = 'main',
  report?: LayoutReport,
  mode: 'create' | 'replace' = 'create'
): string {
  const data = readStudio(source);
  const selected = data.pcbs?.[board]?.profile;
  const previousProfile =
    mode === 'replace' && selected?.startsWith('profiles.')
      ? selected.slice('profiles.'.length)
      : '';
  const previousFrom = data.designs?.profiles?.[previousProfile]?.from;
  const previousBoundary =
    typeof previousFrom === 'string' && previousFrom.startsWith('boundaries.')
      ? previousFrom.slice('boundaries.'.length)
      : '';
  const previous = (data.designs?.boundaries?.[previousBoundary] ||
    {}) as Record<string, unknown>;
  const objects: Record<string, StudioItem> = { ...data.layout.objects };
  for (const [id, item] of Object.entries(report?.objects || {})) {
    if (!objects[id]) {
      objects[id] = item;
    }
  }
  const groups: Record<string, string[]> = {};
  for (const [id, item] of Object.entries(objects)) {
    if (
      item.kind === 'anchor' ||
      (item.pcb && item.pcb !== board) ||
      (!item.pcb && item.kind !== 'key')
    ) {
      continue;
    }
    const envelopes = {
      ...data.parts?.[item.part || '']?.envelopes,
      ...item.envelopes,
    };
    const name =
      item.kind === 'key' && envelopes.keycap
        ? 'keycap'
        : envelopes.pcb
          ? 'pcb'
          : envelopes.body
            ? 'body'
            : '';
    if (name) {
      (groups[`${item.kind}:${name}`] ||= []).push(id);
    }
  }
  if (!Object.keys(groups).length) {
    throw new Error(
      'Add keys or PCB components with physical envelopes first.'
    );
  }
  let result = source;
  const sources = [];
  for (const group of Object.keys(groups)) {
    const [kind, envelope] = group.split(':');
    const region = nextId(
      Object.keys(readStudio(result).designs?.regions || {}),
      `${board}_${envelope}`
    );
    result = setValue(result, ['designs', 'regions', region], {
      select:
        Object.keys(groups).filter((key) => key.startsWith(`${kind}:`))
          .length === 1
          ? { kind, pcb: board }
          : { ids: groups[group] },
      envelope,
      ...(kind === 'key' ? { close: 2 } : {}),
    });
    sources.push(`regions.${region}`);
  }
  const profile =
    previousProfile ||
    nextId(Object.keys(data.designs?.profiles || {}), `${board}_outline`);
  // Connect the nearest groups with authored webs; finishing never guesses a bridge.
  const physical = Object.values(groups).flat();
  const linked = new Set(physical.slice(0, 1));
  const bridges: Record<string, unknown> = {};
  const position = (id: string) => report?.objects[id]?.position || [0, 0, 0];
  while (linked.size < physical.length) {
    const pairs = Array.from(linked).flatMap((a) =>
      physical
        .filter((b) => !linked.has(b))
        .map((b) => ({
          a,
          b,
          distance: Math.hypot(
            ...position(a).map((v, i) => v - position(b)[i])
          ),
        }))
    );
    pairs.sort((a, b) => a.distance - b.distance);
    const pair = pairs[0];
    const a = objects[pair.a],
      b = objects[pair.b];
    if (
      (!a.cluster || a.cluster !== b.cluster) &&
      (!report || pair.distance > 0.001)
    ) {
      bridges[nextId(Object.keys(bridges), `${pair.a}_${pair.b}`)] = {
        from: { ref: pair.a },
        to: { ref: pair.b },
        width: 10,
        ends: 'flat',
      };
    }
    linked.add(pair.b);
  }
  const boundary =
    previousBoundary ||
    nextId(Object.keys(data.designs?.boundaries || {}), `${board}_edge`);
  result = setValue(result, ['designs', 'boundaries', boundary], {
    clearance: 2,
    simplify: 2,
    corners: { fillet: 1 },
    connected: 'single',
    ...previous,
    from: sources,
    bridges: {
      ...bridges,
      ...((previous.bridges as Record<string, unknown>) || {}),
    },
  });
  const ownedBridges = (getValue(source, [
    'meta',
    'studio',
    'bridges',
    boundary,
  ]) || []) as string[];
  result = setValue(
    result,
    ['meta', 'studio', 'bridges', boundary],
    Array.from(
      new Set([
        ...ownedBridges,
        ...Object.keys(bridges).filter(
          (id) => !(id in ((previous.bridges as Record<string, unknown>) || {}))
        ),
      ])
    )
  );
  result = setValue(result, ['designs', 'profiles', profile], {
    ...data.designs?.profiles?.[profile],
    from: `boundaries.${boundary}`,
  });
  result = setValue(result, ['pcbs', board, 'profile'], `profiles.${profile}`);
  if (!data.pcbs?.[board]?.thickness) {
    result = setValue(result, ['pcbs', board, 'thickness'], 1.6);
  }
  for (const id of Object.keys(data.layout.objects || {})) {
    if (
      data.layout.objects![id].kind === 'key' &&
      !data.layout.objects![id].pcb
    ) {
      result = setValue(result, ['layout', 'objects', id, 'pcb'], board);
    }
  }
  return result;
}
