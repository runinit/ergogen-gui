import { isAlias, isMap, isSeq, parseDocument, stringify } from 'yaml';
import { editDesign, SourcePath } from './designSource';

export type LayoutSection = 'objects' | 'clusters';
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const PRECISION = 1_000_000;

// Only materialize the selected instance; leave the shared alias definition intact.
function instance(source: string, path: SourcePath): string {
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length) {
    throw new Error(document.errors[0].message);
  }
  const node = document.getIn(path, true);
  if (!node) {
    throw new Error('Missing layout object; regenerate before editing.');
  }
  if (!isAlias(node) || !node.range) {
    return source;
  }
  const resolved = node.resolve(document);
  if (!isMap(resolved)) {
    throw new Error('The selected alias must reference an object.');
  }
  const value = resolved.toJSON();
  const rendered = stringify(value, {
    collectionStyle: 'flow',
    lineWidth: 0,
  }).trim();
  return (
    source.slice(0, node.range[0]) + rendered + source.slice(node.range[1])
  );
}

function target(source: string, section: LayoutSection, id: string) {
  const data = parseDocument(source).toJS();
  const root = ['layout', section, id];
  if (data?.layout?.[section]?.[id]) {
    const cluster = data.layout[section][id].cluster;
    return {
      root,
      locked: !!data.layout.clusters?.[cluster]?.locked,
      generated: false,
    };
  }
  for (const [cluster, value] of Object.entries(data?.layout?.clusters || {})) {
    const spec = value as { mirror?: { source: string }; locked?: boolean };
    if (
      section !== 'objects' ||
      !spec.mirror ||
      !id.startsWith(`${cluster}__`)
    ) {
      continue;
    }
    const member = id.slice(cluster.length + 2);
    if (data.layout.objects?.[member]?.cluster === spec.mirror.source) {
      return {
        root: ['layout', 'clusters', cluster, 'overrides', member],
        locked: !!spec.locked,
        generated: true,
      };
    }
  }
  throw new Error('Missing layout object; regenerate before editing.');
}

export function setLayout(
  source: string,
  section: LayoutSection,
  id: string,
  field: SourcePath,
  value: unknown
): string {
  const { root, locked, generated } = target(source, section, id);
  let result = generated ? source : instance(source, root);
  const path = [...root, ...field];
  const document = parseDocument(result);
  if (
    locked ||
    (document.getIn([...root, 'locked']) && field[0] !== 'locked')
  ) {
    throw new Error('This object is locked.');
  }
  const node = document.getIn(path, true);
  if (
    Array.isArray(value) &&
    isSeq(node) &&
    node.items.length === value.length
  ) {
    value.forEach((item, index) => {
      result = editDesign(result, [...path, index], item);
    });
    return result;
  }
  return editDesign(result, path, value);
}

export function moveLayout(
  source: string,
  section: LayoutSection,
  id: string,
  delta: number[],
  frame: number[] = IDENTITY
): string {
  const local = [0, 1, 2].map(
    (axis) =>
      Math.round(
        [0, 1, 2].reduce(
          (sum, row) => sum + frame[row * 4 + axis] * delta[row],
          0
        ) * PRECISION
      ) / PRECISION
  );
  const { root, generated } = target(source, section, id);
  const materialized = generated ? source : instance(source, root);
  const current = parseDocument(materialized).getIn([
    ...root,
    'placement',
    'override',
    'at',
  ]) as { toJSON?: () => unknown } | undefined;
  const coordinates = (current?.toJSON?.() || [0, 0, 0]) as (number | string)[];
  const next = coordinates.map((value, index) =>
    typeof value === 'number'
      ? value + local[index]
      : `(${value}) + ${local[index]}`
  );
  return setLayout(
    materialized,
    section,
    id,
    ['placement', 'override', 'at'],
    next
  );
}
