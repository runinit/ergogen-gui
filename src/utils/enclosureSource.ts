import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  stringify,
} from 'yaml';
import { cncDefaults, JLC_PRESET, supplierPreset } from './casePresets';
import { editDesign, SourcePath } from './designSource';

export const CASE_STEPS = [
  'Layout',
  'Manufacturing',
  'Mounting',
  'Enclosure',
  'Components',
  'Hardware',
  'Review',
];
export const MOUNT_STYLES = ['tray', 'top', 'bottom', 'gasket'];

export function caseNames(source: string): string[] {
  const data = parseDocument(source).toJS();
  return Object.entries(data?.designs?.assemblies || {})
    .filter(
      ([, value]) => (value as { preset?: string }).preset === 'enclosure'
    )
    .map(([name]) => name);
}

export function createCase(source: string, name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      'Use a name starting with a letter, followed by letters, digits or underscores.'
    );
  }
  const doc = parseDocument(source);
  if (doc.errors.length) {
    throw new Error(doc.errors[0].message);
  }
  const data = doc.toJS();
  if (data?.schema !== 'ergogen/v1') {
    throw new Error(
      'Case creation requires a native schema: ergogen/v1 document. The original source is preserved.'
    );
  }
  const boardId = Object.keys(data.pcbs || {})[0];
  const boardProfile = data.pcbs?.[boardId]?.profile;
  for (const path of [
    ['designs', 'assemblies', name],
    ['designs', 'profiles', `${name}_board`],
    ['outlines', `${name}_board`],
  ]) {
    if (doc.getIn(path) !== undefined) {
      throw new Error(`A design or output named ${name} already exists.`);
    }
  }
  const definitions: [SourcePath, unknown][] = [
    [
      ['regions', `${name}_keys`],
      { select: { kind: 'key' }, envelope: 'pcb', close: 2 },
    ],
    [
      ['regions', `${name}_switches`],
      { select: { kind: 'key' }, envelope: 'plate' },
    ],
    [
      ['boundaries', `${name}_body`],
      { from: `regions.${name}_keys`, clearance: 2 },
    ],
    [['profiles', `${name}_board`], { from: `boundaries.${name}_body` }],
    [
      ['assemblies', name],
      {
        preset: 'enclosure',
        profile: boardProfile || `profiles.${name}_board`,
        mounting: '',
        construction: 'cover',
        supplier: JLC_PRESET,
        ...(boardId ? { board: { source: 'generated', name: boardId } } : {}),
        manufacturing: {
          bottom: cncDefaults(13, 'bottom'),
          top: cncDefaults(11, 'top'),
          plate: cncDefaults(1.5, 'plate'),
        },
        internal_radius: 2.5,
        wall: 3,
        floor: 2,
        height: 24,
        plate: 1.5,
        plate_z: 13,
        bezel: 10,
        fit: 0.5,
        cutouts: [`regions.${name}_switches`],
      },
    ],
  ];
  let result = source;
  for (const [path, value] of definitions) {
    if (boardProfile && path[0] !== 'assemblies') {
      continue;
    }
    if (boardProfile && path[0] === 'assemblies') {
      (value as { cutouts: string[] }).cutouts = [];
    }
    result = editDesign(result, ['designs', ...path], value);
  }
  const boards = Object.keys(doc.toJS()?.pcbs || {});
  if (boards.length === 1) {
    result = editCase(result, name, ['board'], {
      source: 'generated',
      name: boards[0],
    });
  }
  return editDesign(result, ['meta', 'enclosures', name], {
    version: 2,
    supplier: supplierPreset,
  });
}

export function editCase(
  source: string,
  name: string,
  path: SourcePath,
  value: unknown
): string {
  const full = ['designs', 'assemblies', name, ...path];
  const node = parseDocument(source).getIn(full, true);
  // Materialize only the edited alias; its shared anchor remains unchanged.
  if (isAlias(node) && node.range) {
    const rendered = stringify(value, {
      collectionStyle: 'flow',
      aliasDuplicateObjects: false,
      lineWidth: 0,
    }).trimEnd();
    return (
      source.slice(0, node.range[0]) + rendered + source.slice(node.range[1])
    );
  }
  if (
    isMap(node) &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    let result = source;
    const entries = value as Record<string, unknown>;
    for (const pair of node.items) {
      if (isScalar(pair.key) && !(String(pair.key.value) in entries)) {
        result = removeCaseField(result, name, [
          ...path,
          String(pair.key.value),
        ]);
      }
    }
    for (const [key, next] of Object.entries(entries)) {
      result = editCase(result, name, [...path, key], next);
    }
    return result;
  }
  if (isSeq(node) && Array.isArray(value) && node.range) {
    if (node.items.length === value.length) {
      return value.reduce(
        (result, next, index) => editCase(result, name, [...path, index], next),
        source
      );
    }
    const rendered = stringify(value, {
      collectionStyle: 'flow',
      aliasDuplicateObjects: false,
      lineWidth: 0,
    }).trimEnd();
    return (
      source.slice(0, node.range[0]) + rendered + source.slice(node.range[1])
    );
  }
  return editDesign(source, full, value);
}

function appendDesignRef(
  source: string,
  path: SourcePath,
  ref: string
): string {
  const sequence = parseDocument(source).getIn(path, true);
  if (sequence === undefined) {
    return editDesign(source, path, [ref]);
  }
  if (!isSeq(sequence) || !sequence.range) {
    throw new Error('Add this reference in the advanced editor.');
  }
  if (sequence.items.some((item) => isScalar(item) && item.value === ref)) {
    return source;
  }
  if (sequence.flow) {
    const end = source.lastIndexOf(']', sequence.range[1]);
    return (
      source.slice(0, end) +
      (sequence.items.length ? ', ' : '') +
      JSON.stringify(ref) +
      source.slice(end)
    );
  }
  const first = sequence.items[0];
  if (!isScalar(first) || !first.range) {
    throw new Error('Add this reference in the advanced editor.');
  }
  const start = source.lastIndexOf('\n', first.range[0]) + 1;
  const indent = source.slice(start, first.range[0]).indexOf('-');
  const end = sequence.range[2];
  return (
    source.slice(0, end) +
    `${' '.repeat(Math.max(0, indent))}- ${ref}\n` +
    source.slice(end)
  );
}

// Delete one block entry; retain all surrounding declarations and their bytes.
export function removeCaseField(
  source: string,
  name: string,
  path: SourcePath
): string {
  const doc = parseDocument(source, { keepSourceTokens: true });
  const full = ['designs', 'assemblies', name, ...path];
  const parent = doc.getIn(full.slice(0, -1), true);
  if (!isMap(parent)) {
    throw new Error('Remove this custom entry in the advanced editor.');
  }
  const pair = parent.items.find(
    (item) => isScalar(item.key) && item.key.value === full.at(-1)
  );
  const key = pair?.key;
  const value = pair?.value;
  if (
    !isScalar(key) ||
    !key.range ||
    !value ||
    typeof value !== 'object' ||
    !('range' in value) ||
    !value.range
  ) {
    throw new Error('This entry cannot be removed safely.');
  }
  if (parent.flow && parent.range) {
    const index = parent.items.indexOf(pair!);
    const start = key.range[0],
      end = (value.range as [number, number, number])[1];
    if (parent.items.length === 1) {
      return (
        source.slice(0, parent.range[0]) + '{}' + source.slice(parent.range[1])
      );
    }
    if (index < parent.items.length - 1) {
      const comma = source.indexOf(',', end);
      return source.slice(0, start) + source.slice(comma + 1);
    }
    const previous = parent.items[index - 1].value as {
      range: [number, number, number];
    };
    const comma = source.indexOf(',', previous.range[1]);
    return source.slice(0, comma) + source.slice(end);
  }
  if (parent.items.length === 1 && parent.range) {
    return (
      source.slice(0, parent.range[0]) + '{}\n' + source.slice(parent.range[2])
    );
  }
  const start = source.lastIndexOf('\n', key.range[0] - 1) + 1;
  const end = (value.range as [number, number, number])[2];
  return source.slice(0, start) + source.slice(end);
}

// Change only a selected scalar item, leaving other entries and comments intact.
export function toggleDesignRef(
  source: string,
  path: SourcePath,
  ref: string
): string {
  const node = parseDocument(source).getIn(path, true);
  if (!isSeq(node)) {
    return editDesign(source, path, [ref]);
  }
  const index = node.items.findIndex(
    (item) => isScalar(item) && item.value === ref
  );
  if (index < 0) {
    return appendDesignRef(source, path, ref);
  }
  const item = node.items[index];
  if (!isScalar(item) || !item.range || !node.range) {
    throw new Error('Edit this custom selection in YAML.');
  }
  if (node.flow) {
    const previous = node.items[index - 1];
    const next = node.items[index + 1];
    let start = item.range[0],
      end = item.range[1];
    if (next && isScalar(next) && next.range) {
      end = source.indexOf(',', end) + 1;
    } else if (previous && isScalar(previous) && previous.range) {
      start = source.indexOf(',', previous.range[1]);
    }
    return source.slice(0, start) + source.slice(end);
  }
  // An empty sequence is explicit, so removing the last selection never means all.
  if (node.items.length === 1) {
    return (
      source.slice(0, node.range[0]) + '[]\n' + source.slice(node.range[2])
    );
  }
  const start = source.lastIndexOf('\n', item.range[0] - 1) + 1;
  return source.slice(0, start) + source.slice(item.range[2]);
}

// Apply only fields the gesture changed; analysis may describe an older draft.
export function editCaseChanges(
  source: string,
  name: string,
  path: SourcePath,
  before: unknown,
  after: unknown
): string {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return source;
  }
  const existing = parseDocument(source).getIn(
    ['designs', 'assemblies', name, ...path],
    true
  );
  if (isAlias(existing)) {
    return editCase(source, name, path, after);
  }
  if (Array.isArray(after)) {
    if (
      !isSeq(existing) ||
      !Array.isArray(before) ||
      existing.items.length !== after.length ||
      before.length !== after.length
    ) {
      return editCase(source, name, path, after);
    }
  }
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after)
  ) {
    let result = source;
    for (const key of Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)])
    )) {
      const child = Array.isArray(after) ? Number(key) : key;
      const previous = (before as Record<string, unknown>)[key];
      const next = (after as Record<string, unknown>)[key];
      result =
        next === undefined
          ? removeCaseField(result, name, [...path, child])
          : editCaseChanges(result, name, [...path, child], previous, next);
    }
    return result;
  }
  return editCase(source, name, path, after);
}

// Serialize only the edited assembly; unrelated source bytes stay untouched.
export function batchCaseEdit(
  source: string,
  name: string,
  update: (doc: ReturnType<typeof parseDocument>, path: string[]) => void
): string {
  const doc = parseDocument(source);
  const path = ['designs', 'assemblies', name];
  const node = doc.getIn(path, true);
  if (!isMap(node) || !node.range) {
    throw new Error('The case must be a YAML mapping.');
  }
  const [start, end] = node.range;
  const indent = start - source.lastIndexOf('\n', start - 1) - 1;
  update(doc, path);
  const rendered = stringify(doc.getIn(path, true), { lineWidth: 0 })
    .trimEnd()
    .split('\n')
    .map((line, index) => (index ? ' '.repeat(indent) + line : line))
    .join('\n');
  return source.slice(0, start) + rendered + '\n' + source.slice(end);
}
