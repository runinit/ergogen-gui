import { isMap, isScalar, parseDocument } from 'yaml';

type FootprintUse = { path: string[]; what: string };
export function footprintUses(source: string): FootprintUse[] {
  const doc = parseDocument(source);
  if (doc.errors.length) {
    return [];
  }
  const uses: FootprintUse[] = [];
  const tables: string[][] = [['parts'], ['layout', 'objects']];
  const clusters = doc.getIn(['layout', 'clusters']);
  if (isMap(clusters)) {
    for (const entry of clusters.items) {
      if (isScalar(entry.key)) {
        tables.push([
          'layout',
          'clusters',
          String(entry.key.value),
          'overrides',
        ]);
      }
    }
  }
  for (const path of tables) {
    const table = doc.getIn(path);
    if (!isMap(table)) {
      continue;
    }
    for (const item of table.items) {
      if (!isScalar(item.key) || !isMap(item.value)) {
        continue;
      }
      const footprints = item.value.get('footprints');
      if (!isMap(footprints)) {
        continue;
      }
      for (const entry of footprints.items) {
        if (!isScalar(entry.key) || !isMap(entry.value)) {
          continue;
        }
        const what = entry.value.get('what');
        if (typeof what === 'string') {
          uses.push({
            path: [
              ...path,
              String(item.key.value),
              'footprints',
              String(entry.key.value),
              'what',
            ],
            what,
          });
        }
      }
    }
  }
  return uses;
}
export function linkFootprint(
  source: string,
  use: FootprintUse,
  alias: string
) {
  const doc = parseDocument(source);
  if (doc.errors.length) {
    throw new Error('Repair the project YAML before linking.');
  }
  if (doc.getIn(use.path) !== use.what) {
    throw new Error(
      'This footprint declaration changed. Select it again before linking.'
    );
  }
  const node = doc.getIn(use.path, true);
  if (!isScalar(node) || !node.range) {
    throw new Error('Choose an explicit footprint declaration to link.');
  }
  // Replace the scalar range only; surrounding formatting and comments keep their bytes.
  return (
    source.slice(0, node.range[0]) +
    JSON.stringify(alias) +
    source.slice(node.range[1])
  );
}
