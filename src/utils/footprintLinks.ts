import { isMap, isScalar, parseDocument } from 'yaml';

type FootprintUse = { path: string[]; what: string };
export function footprintUses(source: string): FootprintUse[] {
  const doc = parseDocument(source);
  if (doc.errors.length) {
    return [];
  }
  const uses: FootprintUse[] = [];
  const pcbs = doc.get('pcbs');
  if (!isMap(pcbs)) {
    return uses;
  }
  for (const board of pcbs.items) {
    if (!isScalar(board.key) || !isMap(board.value)) {
      continue;
    }
    const footprints = board.value.get('footprints');
    if (!isMap(footprints)) {
      continue;
    }
    for (const footprint of footprints.items) {
      if (!isScalar(footprint.key) || !isMap(footprint.value)) {
        continue;
      }
      const what = footprint.value.get('what');
      if (typeof what === 'string') {
        uses.push({
          path: [
            'pcbs',
            String(board.key.value),
            'footprints',
            String(footprint.key.value),
            'what',
          ],
          what,
        });
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
