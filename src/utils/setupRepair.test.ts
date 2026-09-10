import { expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { compileSetup, defaultSetup } from './designSetup';
import { repairSetup, setupBaseline } from './setupRepair';
it('repairs a saved setup once without changing manual wiring or authored regions', () => {
  const setup = { ...defaultSetup(), led: true, columns: 2, rows: 1 };
  const old = parse(setupBaseline(setup, 1));
  old.layout.objects.fingers_c2_r1_led.footprints.main.params.P4 = 'CUSTOM';
  old.designs.regions.custom = { select: { kind: 'key' }, envelope: 'pcb' };
  const source = stringify(old),
    result = repairSetup(source),
    doc = parse(result);
  expect(doc.layout.objects.fingers_c1_r1_led.footprints.main.params.P4).toBe(
    'LED_DATA'
  );
  expect(doc.layout.objects.fingers_c2_r1_led.footprints.main.params.P4).toBe(
    'CUSTOM'
  );
  expect(doc.designs.regions.main.envelope).toBe('keycap');
  expect(doc.designs.regions.custom.envelope).toBe('pcb');
  expect(doc.meta.studio.electricalFindings.join(' ')).toContain('custom');
  expect(repairSetup(result)).toBe(result);
  expect(parse(compileSetup(setup)).meta.studio.setupRevision).toBe(2);
});
