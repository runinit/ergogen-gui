import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { compileSetup, defaultSetup } from './designSetup';
import { applyAssembly } from './applyAssembly';
import { resizeCluster, addCluster, setValue } from './studioSource';
import { ResizeReview } from './resizeReview';
import { updateSetup } from './updateSetup';
import * as ergogen from 'ergogen';
import bundled from '../../.generated/footprints.json';
import extras from '../catalogue/footprints.json';
import { createInjectionModule } from './injectionEvaluator';
for (const [name, source] of Object.entries({ ...bundled, ...extras })) {
  ergogen.inject('footprint', name, createInjectionModule(source));
}
it('can grow the matrix after default onboarding', () => {
  const source = compileSetup(defaultSetup());
  expect(() =>
    resizeCluster(source, 'fingers', {
      columns: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
    })
  ).not.toThrow();
});
it('can add a cluster after default onboarding', () => {
  expect(() =>
    addCluster(compileSetup(defaultSetup()), 'thumbs', 'arc')
  ).not.toThrow();
});
it('connects MCU LED data to Data-In, pad 4', () => {
  const doc = parse(compileSetup({ ...defaultSetup(), led: true }));
  expect(doc.layout.objects.fingers_c1_r1_led.footprints.main.params.P4).toBe(
    'LED_DATA'
  );
});
it('preserves the LED chain when changing a key assembly placement', () => {
  const setup = { ...defaultSetup(), led: true };
  const source = compileSetup(setup);
  const before =
    parse(source).layout.objects.fingers_c1_r2_led.footprints.main.params;
  setup.template.led.at = [3, 6];
  const after = parse(
    applyAssembly(source, ['fingers_c1_r1', 'fingers_c1_r2'], setup, 'preserve')
  );
  expect(after.layout.objects.fingers_c1_r2_led.footprints.main.params).toEqual(
    before
  );
});
it('moves switch clearance with the assembly footprint', () => {
  const setup = defaultSetup();
  const source = compileSetup(setup);
  setup.template.switch.at = [8, 0];
  const object = parse(
    applyAssembly(source, ['fingers_c1_r1'], setup, 'replace')
  ).layout.objects.fingers_c1_r1;
  expect(object.envelopes.body.at).toEqual(
    object.footprints.switch.placement.at
  );
});
it('keeps the generated document valid when shrinking after a manual key edit', async () => {
  const setup = { ...defaultSetup(), columns: 2, rows: 1 };
  let source = compileSetup(setup);
  source = setValue(
    source,
    ['layout', 'objects', 'fingers_c2_r1', 'placement'],
    { override: { at: [3, 0, 0] } }
  );
  let review: ResizeReview | undefined;
  try {
    updateSetup(source, { ...setup, columns: 1 });
  } catch (error) {
    if (error instanceof ResizeReview) {
      review = error;
    } else {
      throw error;
    }
  }
  expect(review?.proposal.keys).toContain('fingers_c2_r1');
  expect(review?.proposal.before).toBe(source);
  await expect(
    ergogen.process(review!.proposal.after, { analysis: true })
  ).resolves.toBeDefined();
});
it('keeps a resized outside key inside the automatic board outline', async () => {
  const { resizeKey } = await import('./keyResize');
  const m = await import('makerjs');
  const setup = { ...defaultSetup(), columns: 1, rows: 1, diode: false };
  const source = resizeKey(compileSetup(setup), 'fingers_c1_r1', [27.525, 18]);
  const result = await ergogen.process(source, { analysis: true });
  const key = result.layout.objects.fingers_c1_r1;
  const bounds = m.measure.modelExtents(
    result.designs.features['profiles.main'].model
  );
  expect(bounds!.high[0]).toBeGreaterThanOrEqual(key.bounds.keycap[1][0]);
});
it('grows a matrix with its existing net names and allocates an unused GPIO', () => {
  const source = compileSetup({
    ...defaultSetup(),
    columns: 2,
    rows: 1,
    controller: 'promicro',
  });
  const doc = parse(
    resizeCluster(source, 'fingers', { columns: ['c1', 'c2', 'c3'] })
  );
  expect(doc.layout.objects.fingers_c3_r1.footprints.switch.params.from).toBe(
    'C3'
  );
  expect(doc.layout.objects.fingers_c3_r1_diode.footprints.main.params.to).toBe(
    'R1'
  );
  expect(doc.layout.objects.controller.footprints.main.params.P2).toBe('R1');
  expect(doc.layout.objects.controller.footprints.main.params.P3).toBe('C3');
});
it('preserves manually assigned switch nets when moving its assembly', () => {
  const setup = defaultSetup();
  const source = setValue(
    compileSetup(setup),
    [
      'layout',
      'objects',
      'fingers_c1_r1',
      'footprints',
      'switch',
      'params',
      'from',
    ],
    'MY_COL'
  );
  setup.template.switch.at = [2, 1];
  expect(
    parse(applyAssembly(source, ['fingers_c1_r1'], setup, 'preserve')).layout
      .objects.fingers_c1_r1.footprints.switch.params.from
  ).toBe('MY_COL');
});
it('updates linked mirrored bindings and adds new right-board keys', () => {
  const setup = {
    ...defaultSetup(),
    columns: 2,
    rows: 1,
    led: true,
    topology: 'mirrored' as const,
  };
  const source = compileSetup(setup);
  setup.family = 'choc_v1';
  let next = applyAssembly(source, ['left_fingers_c1_r1'], setup, 'preserve');
  next = resizeCluster(next, 'left_fingers', { columns: ['c1', 'c2', 'c3'] });
  const overrides = parse(next).layout.clusters.right_fingers.overrides;
  expect(overrides.left_fingers_c1_r1.footprints.switch.what).toBe(
    'ceoloide/switch_choc_v1_v2'
  );
  expect(overrides.left_fingers_c3_r1.pcb).toBe('right');
  expect(overrides.left_fingers_c3_r1.footprints.switch.params.from).toBe(
    'right_C3'
  );
  expect(overrides.left_fingers_c3_r1_led.properties.owner).toBe(
    'right_fingers__left_fingers_c3_r1'
  );
  expect(overrides.left_fingers_c3_r1_led.footprints.main.params.P4).toBe(
    overrides.left_fingers_c2_r1_led.footprints.main.params.P2
  );
});
it('uses an applied cluster assembly for later keys without changing other clusters', () => {
  const setup = { ...defaultSetup(), columns: 1, rows: 1 };
  let source = compileSetup(setup);
  setup.family = 'choc_v1';
  setup.template.name = 'Low profile';
  setup.led = true;
  source = applyAssembly(
    source,
    ['fingers_c1_r1'],
    setup,
    'preserve',
    'cluster'
  );
  const doc = parse(
    resizeCluster(source, 'fingers', { columns: ['c1', 'c2'] })
  );
  expect(doc.layout.objects.fingers_c2_r1.footprints.switch.what).toBe(
    'ceoloide/switch_choc_v1_v2'
  );
  expect(doc.layout.objects.fingers_c2_r1_led).toBeDefined();
});
it('reviews a shrink when only an owned diode was edited', () => {
  const setup = { ...defaultSetup(), columns: 2, rows: 1 };
  const source = setValue(
    compileSetup(setup),
    ['layout', 'objects', 'fingers_c2_r1_diode', 'placement', 'at'],
    [4, -3, 0]
  );
  expect(() => updateSetup(source, { ...setup, columns: 1 })).toThrow(
    ResizeReview
  );
});
it('reconnects managed LEDs after deletion and keeps duplicated nets unique', async () => {
  const { removeObject, duplicateObject } = await import('./studioSource');
  const setup = { ...defaultSetup(), columns: 3, rows: 1, led: true };
  let source = removeObject(compileSetup(setup), 'objects', 'fingers_c2_r1');
  source = duplicateObject(source, 'objects', 'fingers_c1_r1', 'copy');
  const objects = parse(source).layout.objects;
  expect(objects.fingers_c3_r1_led.footprints.main.params.P4).toBe(
    objects.fingers_c1_r1_led.footprints.main.params.P2
  );
  expect(objects.copy_led.footprints.main.params.P4).toBe(
    objects.fingers_c3_r1_led.footprints.main.params.P2
  );
  expect(objects.copy_diode.footprints.main.params.to).toBe('copy_row');
  expect(objects.copy_led.properties.owner).toBe('copy');
});
it('retains customized LED nets and reports incomplete automatic wiring', async () => {
  const { removeObject } = await import('./studioSource');
  const setup = { ...defaultSetup(), columns: 2, rows: 1, led: true };
  let source = setValue(
    compileSetup(setup),
    [
      'layout',
      'objects',
      'fingers_c2_r1_led',
      'footprints',
      'main',
      'params',
      'P4',
    ],
    'USER_DATA'
  );
  source = removeObject(source, 'objects', 'fingers_c1_r1');
  const doc = parse(source);
  expect(doc.layout.objects.fingers_c2_r1_led.footprints.main.params.P4).toBe(
    'USER_DATA'
  );
  expect(doc.meta.studio.electricalFindings.join(' ')).toContain(
    'custom LED wiring'
  );
});
it('rejects locked or externally referenced keys before offering a shrink', () => {
  const setup = { ...defaultSetup(), columns: 2, rows: 1 };
  const source = compileSetup(setup);
  const locked = setValue(
    source,
    ['layout', 'objects', 'fingers_c2_r1_diode', 'locked'],
    true
  );
  expect(() => updateSetup(locked, { ...setup, columns: 1 })).toThrow('Unlock');
  const used = setValue(source, ['layout', 'objects', 'anchor'], {
    kind: 'anchor',
    placement: { ref: 'fingers_c2_r1' },
  });
  expect(() => updateSetup(used, { ...setup, columns: 1 })).toThrow(
    'layout.objects.anchor.placement.ref'
  );
});
it('restores a deleted cell using native diode and LED objects', async () => {
  const { removeObject, addCell } = await import('./studioSource');
  const setup = {
    ...defaultSetup(),
    columns: 2,
    rows: 1,
    led: true,
    mounting: 'hotswap' as const,
  };
  const source = addCell(
    removeObject(compileSetup(setup), 'objects', 'fingers_c1_r1'),
    'fingers',
    'c1',
    'r1'
  );
  const objects = parse(source).layout.objects;
  expect(objects.fingers_c1_r1.footprints.switch.params.hotswap).toBe(true);
  expect(objects.fingers_c1_r1.footprints.studio_diode).toBeUndefined();
  expect(objects.fingers_c1_r1_diode.properties.owner).toBe('fingers_c1_r1');
  expect(objects.fingers_c1_r1_led).toBeDefined();
});
it('keeps new mirrored keys and assembly offsets valid in native PCB and body geometry', async () => {
  const setup = {
    ...defaultSetup(),
    columns: 2,
    rows: 1,
    led: true,
    topology: 'mirrored' as const,
  };
  const source = compileSetup(setup);
  setup.template.switch.at = [3, 1];
  setup.template.switch.rotate = 20;
  let next = applyAssembly(source, ['left_fingers_c1_r1'], setup, 'replace');
  next = resizeCluster(next, 'left_fingers', { columns: ['c1', 'c2', 'c3'] });
  const result = await ergogen.process(next, { analysis: true });
  expect(result.pcbs.left).toContain('left_C3');
  expect(result.pcbs.right).toContain('right_C3');
  expect(result.layout.objects.right_fingers__left_fingers_c3_r1.pcb).toBe(
    'right'
  );
  const left = result.layout.objects.left_fingers_c1_r1;
  expect(left.bounds.body).not.toEqual(left.bounds.plate);
});
it('adds PCB support when enabling electronics on a diode-free setup', async () => {
  const setup = { ...defaultSetup(), columns: 1, rows: 1, diode: false };
  const source = compileSetup(setup);
  setup.led = true;
  setup.template.led.at = [11, 5];
  const next = applyAssembly(source, ['fingers_c1_r1'], setup, 'preserve');
  const doc = parse(next);
  expect(doc.designs.boundaries.main.from).toContain('regions.main_components');
  const m = await import('makerjs');
  const result = await ergogen.process(next, { analysis: true });
  const bounds = m.measure.modelExtents(
    result.designs.features['profiles.main'].model
  );
  expect(bounds!.high[0]).toBeGreaterThanOrEqual(
    result.layout.objects.fingers_c1_r1_led.bounds.pcb[1][0]
  );
});
it('keeps a managed LED chain connected when reopening setup after layout edits', () => {
  const setup = { ...defaultSetup(), columns: 2, rows: 1, led: true };
  const grown = resizeCluster(compileSetup(setup), 'fingers', {
    columns: ['c1', 'c2', 'c3'],
  });
  const objects = parse(updateSetup(grown, { ...setup, rows: 2 })).layout
    .objects;
  const leds = Object.values(objects).filter(
    (item) =>
      (item as { properties?: { role?: string } }).properties?.role === 'led'
  ) as { footprints: { main: { params: Record<string, string> } } }[];
  const outputs = leds.map((item) => item.footprints.main.params.P2);
  const inputs = leds.map((item) => item.footprints.main.params.P4);
  expect(inputs.filter((input) => input === 'LED_DATA')).toHaveLength(1);
  expect(
    inputs
      .filter((input) => input !== 'LED_DATA')
      .every((input) => outputs.includes(input))
  ).toBe(true);
});
it('keeps existing controller assignments when resizing through setup', () => {
  const setup = {
    ...defaultSetup(),
    columns: 2,
    rows: 1,
    controller: 'promicro',
  };
  const params = parse(
    updateSetup(compileSetup(setup), { ...setup, columns: 3 })
  ).layout.objects.controller.footprints.main.params;
  expect(params.P2).toBe('R1');
  expect(params.P3).toBe('C3');
});
it('reviews mirrored key edits before removing their source column', () => {
  const setup = {
    ...defaultSetup(),
    columns: 2,
    rows: 1,
    topology: 'mirrored' as const,
  };
  const source = setValue(
    compileSetup(setup),
    [
      'layout',
      'clusters',
      'right_fingers',
      'overrides',
      'left_fingers_c2_r1',
      'placement',
    ],
    { override: { at: [2, 0, 0] } }
  );
  expect(() => updateSetup(source, { ...setup, columns: 1 })).toThrow(
    ResizeReview
  );
});
it('generates a PCB after disabling the last owned component', async () => {
  const setup = { ...defaultSetup(), columns: 1, rows: 1 };
  const source = compileSetup(setup);
  const next = applyAssembly(
    source,
    ['fingers_c1_r1'],
    { ...setup, diode: false },
    'preserve'
  );
  await expect(
    ergogen.process(next, { analysis: true })
  ).resolves.toBeDefined();
});
it('resolves the added arc cluster and its owned electronics', async () => {
  const source = addCluster(
    compileSetup({ ...defaultSetup(), columns: 2, rows: 1, led: true }),
    'thumbs',
    'arc'
  );
  await expect(
    ergogen.process(source, { layoutOnly: true })
  ).resolves.toBeDefined();
});
