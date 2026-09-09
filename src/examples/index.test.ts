import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { exampleOptions } from './index';
import BHK from './bhk';

it('offers only native configurations with stable BHK object identities', () => {
  const examples = exampleOptions.flatMap((group) => group.options);
  for (const example of examples) {
    expect(parse(example.value).schema).toBe('ergogen/v1');
  }
  const config = parse(BHK.value);
  expect(
    (Object.values(config.layout.objects) as { kind: string }[]).filter(
      (item: { kind: string }) => item.kind === 'key'
    )
  ).toHaveLength(33);
  expect(config.pcbs.bhk_pcb.profile).toBe('profiles.bhk');
  for (const name of ['matrix', 'thumbs']) {
    expect(config.designs.regions[name].wrap ?? 'tight').toBe('tight');
    expect(config.designs.regions[name].close).toBe(2);
  }
  expect(config.designs.boundaries.board.bridges.bottom.align).toBe('bottom');
  expect(config.designs.boundaries.board.simplify).toBe(8);
  expect(config.designs.boundaries.board.corners).toEqual({ fillet: 3 });
  expect(config.designs.regions.electronics.wrap).toBe('box');
  expect(config.layout.objects.power_switch.kind).toBe('component');
  expect(config.layout.objects.reset_button.kind).toBe('component');
  expect(config.parts.key.footprints.switches.what).toBe('ceoloide/switch_mx');
  expect(config.layout.objects.matrix_c1_r4.footprints.switches).toBe('S1');
  expect(config.layout.objects.thumbfan_c2_r1.envelopes.keycap.size).toEqual([
    18, 27,
  ]);
});

it('omits obsolete BHK gasket anchors and screw-hole objects', () => {
  const config = parse(BHK.value);
  expect(
    Object.keys(config.layout.objects).filter((id) =>
      /^(gasket_mount_|corne_screw_)/.test(id)
    )
  ).toEqual([]);
  expect(
    Object.keys(config.units).filter((id) => id.startsWith('gasket_'))
  ).toEqual([]);
});
