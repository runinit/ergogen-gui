import { parse } from 'yaml';
import { addCluster, addCell, removeObject } from './studioSource';
import { setKeyOptions, keyElectronics } from './keyOptions';
const source = 'schema: ergogen/v1\nlayout: {objects: {}}\n';
it('inherits matrix key defaults when filling an empty cell', () => {
  let next = addCluster(source, 'fingers', 'columns', { columns: 2, rows: 1 });
  next = setKeyOptions(
    next,
    { size: [22.7625, 18], diode: true, led: true },
    'fingers'
  );
  next = removeObject(next, 'objects', 'fingers_c1_r1');
  next = addCell(next, 'fingers', 'c1', 'r1');
  const item = parse(next).layout.objects.fingers_c1_r1;
  expect(item.envelopes.keycap.size).toEqual([22.7625, 18]);
  expect(item.footprints.studio_diode.params.from).toBe('{{name}}_switch');
  expect(item.footprints.studio_led.params.P4).toBe('{{name}}_led_in');
});
it('restores switch overrides when disabling managed diodes', () => {
  let next = addCluster(source, 'fingers', 'columns');
  next = keyElectronics(next, 'fingers_c1_r1', {
    diode: false,
    led: false,
    diodeAt: [0, -5, 0],
    ledAt: [0, 5, 0],
  });
  const item = parse(next).layout.objects.fingers_c1_r1;
  expect(item.footprints?.studio_diode).toBeUndefined();
  expect(item.footprints?.switch).toBeUndefined();
});

it('compiles managed switch, diode and LED footprints with separate nets', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const engine = require('ergogen');
  const bundled = require('../../.generated/footprints.json');
  const module = { exports: {} };
  new Function('module', bundled['ceoloide/led_sk6812mini-e'])(module);
  engine.inject('footprint', 'ceoloide/led_sk6812mini-e', module.exports);
  const { addOutline } = await import('./studioSource');
  let next = setKeyOptions(source, { diode: true, led: true });
  next = addCluster(next, 'fingers', 'columns', { columns: 2, rows: 1 });
  next = addOutline(next);
  const result = await engine.process(next, { analysis: true });
  expect(result.pcbs.main).toContain('ComboDiode');
  expect(result.pcbs.main).toContain('SK6812');
  expect(result.pcbs.main).toContain('fingers_c1_r1_switch');
  expect(result.pcbs.main).toContain('fingers_c2_r1_switch');
  expect(result.pcbs.main).toContain('fingers_c1_r1_led_in');
  expect(result.pcbs.main).toContain('fingers_c1_r1_led_out');
});

it('keeps electronics editable after duplicating a key', async () => {
  const { duplicateObject } = await import('./studioSource');
  let next = addCluster(source, 'fingers', 'columns');
  next = duplicateObject(next, 'objects', 'fingers_c1_r1', 'copy');
  next = keyElectronics(next, 'copy', {
    diode: false,
    led: false,
    diodeAt: [0, -5, 0],
    ledAt: [0, 5, 0],
  });
  expect(
    parse(next).layout.objects.copy.footprints?.studio_diode
  ).toBeUndefined();
  expect(
    parse(next).layout.objects.fingers_c1_r1.footprints.studio_diode
  ).toBeDefined();
});
