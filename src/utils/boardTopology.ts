import { initBoardOutlines } from './boardOutlines';
import { resolve } from 'ergogen/src/native/layout';
import { getValue, readStudio, setValue, nextId } from './studioSource';
import { syncAssemblyMirrors } from './assemblyMirrors';

// Topology creates linked geometry; existing objects and PCB identities keep their names.
export function syncBoardTopology(source: string): string {
  const data = readStudio(source);
  const topology = getValue(source, ['meta', 'studio', 'setup', 'topology']);
  const mirrors = Object.values(data.layout.clusters || {}).filter(
    (item) => item.mirror
  );
  if (topology !== 'mirrored') {
    if (mirrors.length) {
      throw new Error(
        'This layout has linked mirror clusters. Keep Mirrored pair while those links exist.'
      );
    }
    return initBoardOutlines(source);
  }
  const boards = Object.keys(data.pcbs || {});
  const first = boards[0] || 'left',
    second = boards[1] || (first === 'right' ? 'left' : 'right');
  let next = source;
  for (const board of [first, second]) {
    if (!data.pcbs?.[board]) {
      next = setValue(next, ['pcbs', board], {
        thickness:
          getValue(source, ['units', 'pcb_thickness']) === undefined
            ? 1.6
            : 'pcb_thickness',
      });
    }
    if (
      !Object.values(data.layout.layers || {}).some(
        (layer) => layer.surface === `pcb.${board}.top`
      )
    ) {
      next = setValue(
        next,
        [
          'layout',
          'layers',
          nextId(Object.keys(readStudio(next).layout.layers || {}), board),
        ],
        { surface: `pcb.${board}.top` }
      );
    }
    if (!getValue(next, ['designs', 'stackups', board])) {
      next = setValue(next, ['designs', 'stackups', board], {
        pcb: board,
        plate: { thickness: 1.5, gap: 5.4 },
        layers: {},
      });
    }
  }
  const layer = Object.entries(readStudio(next).layout.layers || {}).find(
    ([, item]) => item.surface === `pcb.${second}.top`
  )![0];
  for (const [id, cluster] of Object.entries(data.layout.clusters || {})) {
    if (cluster.mirror || mirrors.some((item) => item.mirror?.source === id)) {
      continue;
    }
    const board =
      data.layout.layers?.[cluster.layer || '']?.surface?.match(
        /^pcb\.(.+)\.top$/
      )?.[1] || first;
    if (board !== first) {
      continue;
    }
    if (getValue(next, ['units', 'split_axis']) === undefined) {
      const scene = resolve(readStudio(next));
      const right = Math.max(
        0,
        ...Object.values(scene.objects)
          .filter((item) => item.pcb === first)
          .map((item) => item.position[0])
      );
      next = setValue(
        next,
        ['units', 'split_axis'],
        right + 2 * (scene.units.u || 19)
      );
    }
    const name = nextId(
      Object.keys(readStudio(next).layout.clusters || {}),
      `${id}_mirror`
    );
    next = setValue(next, ['layout', 'clusters', name], {
      label: `${cluster.label || id} · mirror`,
      mirror: { source: id, axis: 'split_axis' },
      layer,
      overrides: {},
    });
  }
  return initBoardOutlines(syncAssemblyMirrors(source, next));
}
