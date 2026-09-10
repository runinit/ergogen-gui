import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { compileSetup, defaultSetup } from './designSetup';
import { setValue } from './studioSource';
import { updateSetup } from './updateSetup';
it('applies setup changes without replacing manual layout edits', () => {
  const setup = defaultSetup();
  let source = '# keep this comment\n' + compileSetup(setup);
  source = setValue(
    source,
    ['layout', 'objects', 'fingers_c1_r1', 'placement'],
    { override: { at: [3, 2, 0] } }
  );
  setup.columns = 6;
  const updated = updateSetup(source, setup);
  expect(updated.startsWith('# keep this comment')).toBe(true);
  const doc = parse(updated);
  expect(doc.layout.objects.fingers_c1_r1.placement.override.at).toEqual([
    3, 2, 0,
  ]);
  expect(doc.layout.clusters.fingers.arrangement.columns).toHaveLength(6);
});
