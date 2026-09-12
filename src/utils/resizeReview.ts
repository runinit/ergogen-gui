import type { DesignSetup } from './designSetup';
import { setupBaseline } from './setupRepair';
import { getValue, readStudio } from './studioSource';
import { parse } from 'yaml';
export type ResizeProposal = {
  before: string;
  after: string;
  keys: string[];
  blockers: string[];
};
export class ResizeReview extends Error {
  constructor(readonly proposal: ResizeProposal) {
    super('Review edited keys before removing them.');
  }
}
// Build the complete candidate first; no source changes until the user accepts it.
export function reviewResize(before: string, after: string, removed: string[]) {
  if (!removed.length) {
    return after;
  }
  const setup = getValue(before, ['meta', 'studio', 'setup']) as
    | DesignSetup
    | undefined;
  const baselineLayout = setup
    ? parse(
        setupBaseline(
          setup,
          Number(getValue(before, ['meta', 'studio', 'setupRevision']) || 1)
        )
      ).layout
    : {};
  const baseline = baselineLayout.objects || {};
  const objects = readStudio(before).layout.objects || {};
  const changed = (id: string) =>
    baseline[id]
      ? JSON.stringify(objects[id]) !== JSON.stringify(baseline[id])
      : !!objects[id]?.placement || !!objects[id]?.envelopes;
  const edited = removed.filter(
    (id) =>
      changed(id) ||
      Object.entries(objects).some(
        ([key, item]) => item.properties?.owner === id && changed(key)
      )
  );
  const mirrored: string[] = [];
  const clusters = readStudio(before).layout.clusters || {};
  for (const [clusterId, cluster] of Object.entries(clusters)) {
    if (!cluster.mirror) {
      continue;
    }
    const overrides = (getValue(before, [
      'layout',
      'clusters',
      clusterId,
      'overrides',
    ]) || {}) as Record<string, unknown>;
    for (const id of removed.filter(
      (id) => objects[id]?.cluster === cluster.mirror?.source
    )) {
      const members = [
        id,
        ...Object.keys(objects).filter(
          (key) => objects[key].properties?.owner === id
        ),
      ];
      if (
        cluster.locked ||
        members.some((key) => (overrides[key] as { locked?: boolean })?.locked)
      ) {
        throw new Error('Unlock mirrored keys before resizing.');
      }
      if (
        members.some(
          (key) =>
            JSON.stringify(overrides[key]) !==
            JSON.stringify(
              baselineLayout.clusters?.[clusterId]?.overrides?.[key]
            )
        )
      ) {
        mirrored.push(`${clusterId}__${id}`);
      }
    }
  }
  if (edited.length || mirrored.length) {
    throw new ResizeReview({
      before,
      after,
      keys: [...removed, ...mirrored],
      blockers: [],
    });
  }
  return after;
}
