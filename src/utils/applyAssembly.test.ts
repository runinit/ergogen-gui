import { expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { compileSetup, defaultSetup } from './designSetup';
import { applyAssembly } from './applyAssembly';
it('changes selected keys without changing their layout or neighbours', () => {
  const setup = defaultSetup(),
    source = compileSetup(setup);
  setup.family = 'choc_v1';
  setup.template.name = 'Low profile';
  const doc = parse(
    applyAssembly(source, ['fingers_c1_r1'], setup, 'preserve')
  );
  expect(doc.layout.objects.fingers_c1_r1.part).toBe('assembly_choc_v1_solder');
  expect(doc.layout.objects.fingers_c1_r1.cell).toEqual(['c1', 'r1']);
  expect(doc.layout.objects.fingers_c1_r2.part).toBe('key');
});
it('keeps owned components in a mirrored source cluster', () => {
  const setup = { ...defaultSetup(), topology: 'mirrored' as const };
  const doc = parse(
    applyAssembly(
      compileSetup(setup),
      ['left_fingers_c1_r1'],
      setup,
      'preserve'
    )
  );
  expect(doc.layout.objects.left_fingers_c1_r1_diode.cluster).toBe(
    'left_fingers'
  );
  expect(doc.layout.objects.left_fingers_c1_r1_diode.cell).toEqual([
    'c1',
    'r1',
  ]);
});
it('preserves explicit switch placement until replacement is requested', () => {
  const setup = defaultSetup();
  const doc = parse(compileSetup(setup));
  doc.layout.objects.fingers_c1_r1.footprints.switch.placement.at = [3, 2, 0];
  setup.template.switch.at = [1, 0];
  const source = stringify(doc);
  const preserved = parse(
    applyAssembly(source, ['fingers_c1_r1'], setup, 'preserve')
  );
  expect(
    preserved.layout.objects.fingers_c1_r1.footprints.switch.placement.at
  ).toEqual([3, 2, 0]);
  const replaced = parse(
    applyAssembly(source, ['fingers_c1_r1'], setup, 'replace')
  );
  expect(
    replaced.layout.objects.fingers_c1_r1.footprints.switch.placement.at
  ).toEqual([1, 0, 0]);
});
it('embeds component definitions when applying to a project without them', () => {
  const setup = defaultSetup();
  const doc = parse(compileSetup(setup));
  delete doc.parts.diode;
  const updated = parse(
    applyAssembly(stringify(doc), ['fingers_c1_r1'], setup, 'preserve')
  );
  const part = updated.layout.objects.fingers_c1_r1_diode.part;
  expect(updated.parts[part]?.envelopes.body.height).toEqual([0, 1.35]);
});
