import type { LayoutReport } from 'ergogen/src/native';
import { readStudio, getValue } from './studioSource';
import { moveLayout, setLayout, type LayoutSection } from './layoutSource';
const NEW_ITEM_GAP = 38;

// Stage additions beside the current layout, ready to drag into place.
export function placeNewItem(
  source: string,
  section: LayoutSection,
  id: string,
  report?: LayoutReport
): string {
  const objects = Object.values(report?.objects || {});
  if (!objects.length) {
    return source;
  }
  const data = readStudio(source),
    item = data.layout[section]?.[id];
  if (!item) {
    return source;
  }
  const parent = item.cluster
    ? report?.clusters[item.cluster]
    : report?.layers[item.layer || 'world'];
  const right = Math.max(
    ...objects.map((object) => {
      const bounds =
        object.bounds?.keycap || object.bounds?.pcb || object.bounds?.body;
      return bounds?.[1][0] ?? object.position[0];
    })
  );
  const bottom = Math.min(...objects.map((object) => object.position[1]));
  const staged = moveLayout(
    source,
    section,
    id,
    [
      right + NEW_ITEM_GAP - (parent?.matrix[3] || 0),
      bottom - (parent?.matrix[7] || 0),
      0,
    ],
    parent?.matrix
  );
  return setLayout(
    source,
    section,
    id,
    ['placement', 'at'],
    getValue(staged, ['layout', section, id, 'placement', 'override', 'at'])
  );
}
