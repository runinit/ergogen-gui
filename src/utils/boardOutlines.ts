import { resolve } from 'ergogen/src/native/layout';
import { addOutline, getValue, readStudio } from './studioSource';

// An empty board gets its first editable outline when physical content is added.
export function initBoardOutlines(source: string): string {
  if (!getValue(source, ['meta', 'studio', 'setupRevision'])) {
    return source;
  }
  const data = readStudio(source);
  const boards = Object.entries(data.pcbs || {}).filter(
    ([, pcb]) => !pcb.profile
  );
  if (!boards.length || !Object.keys(data.layout.objects || {}).length) {
    return source;
  }
  const scene = resolve(data);
  let next = source;
  for (const [board] of boards) {
    if (
      !Object.values(scene.objects).some(
        (item) => item.pcb === board && item.kind !== 'anchor'
      )
    ) {
      continue;
    }
    next = addOutline(next, board, scene);
  }
  return next;
}
