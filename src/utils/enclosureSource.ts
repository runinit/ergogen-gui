import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
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
    [['regions', `${name}_keys`], { where: true, close: 2 }],
    [['regions', `${name}_switches`], { where: true, size: 14 }],
    [
      ['boundaries', `${name}_body`],
      { from: `regions.${name}_keys`, clearance: 2 },
    ],
    [['profiles', `${name}_board`], { from: `boundaries.${name}_body` }],
    [
      ['assemblies', name],
      {
        preset: 'enclosure',
        profile: `profiles.${name}_board`,
        mounting: 'tray',
        wall: 3,
        floor: 2,
        height: 24,
        plate: 1.5,
        plate_z: 13,
        bezel: 8,
        fit: 0.3,
        cutouts: [`regions.${name}_switches`],
      },
    ],
  ];
  let result = source;
  for (const [path, value] of definitions) {
    result = editDesign(result, ['designs', ...path], value);
  }
  return editDesign(result, ['meta', 'enclosures', name], { version: 1 });
}

export function editCase(
  source: string,
  name: string,
  path: SourcePath,
  value: unknown
): string {
  return editDesign(source, ['designs', 'assemblies', name, ...path], value);
}

export function appendDesignRef(
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
  if (!isMap(parent) || parent.flow) {
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
