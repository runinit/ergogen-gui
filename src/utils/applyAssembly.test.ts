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
it('keeps manual model transforms, key dimensions and footprint references', () => {
  const setup = { ...defaultSetup(), columns: 1, rows: 1 };
  const doc = parse(compileSetup(setup));
  const key = doc.layout.objects.fingers_c1_r1;
  key.models[0].offset = [10, 2, 1];
  key.envelopes.keycap = { size: [27.525, 18] };
  key.footprints.switch.reference = 'SW99';
  setup.template.switch.at = [2, 0];
  const result = parse(
    applyAssembly(stringify(doc), ['fingers_c1_r1'], setup, 'preserve')
  ).layout.objects.fingers_c1_r1;
  expect(result.models[0].offset).toEqual([10, 2, 1]);
  expect(result.envelopes.keycap.size).toEqual([27.525, 18]);
  expect(result.footprints.switch.reference).toBe('SW99');
});
it('replaces previously managed attachments with native owned components', () => {
  const setup = { ...defaultSetup(), columns: 1, rows: 1 };
  const doc = parse(compileSetup(setup));
  const key = doc.layout.objects.fingers_c1_r1;
  doc.meta.studio.electronics = {
    fingers_c1_r1: {
      diode: { switch: structuredClone(key.footprints.switch) },
    },
  };
  key.footprints.studio_diode = {
    what: 'diode',
    params: { from: '{{name}}_switch', to: '{{row_net}}' },
  };
  const result = parse(
    applyAssembly(stringify(doc), ['fingers_c1_r1'], setup, 'preserve')
  );
  expect(
    result.layout.objects.fingers_c1_r1.footprints.studio_diode
  ).toBeUndefined();
  expect(result.layout.objects.fingers_c1_r1_diode).toBeDefined();
});
