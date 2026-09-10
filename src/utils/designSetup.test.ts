import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { compileSetup, defaultSetup, setupFindings } from './designSetup';

describe('new design compiler', () => {
  it('creates a matrix with native owned diodes and stable nets', () => {
    const setup = defaultSetup();
    const first = compileSetup(setup);
    expect(compileSetup(setup)).toBe(first);
    const doc = parse(first);
    const objects = Object.values(doc.layout.objects) as any[];
    expect(objects.filter((item) => item.kind === 'key')).toHaveLength(20);
    expect(objects.filter((item) => item.properties?.owner)).toHaveLength(20);
    expect(doc.layout.objects.fingers_c1_r1.properties.column_net).toBe('C1');
    expect(doc.layout.objects.fingers_c1_r1_diode.placement.ref).toBe(
      'fingers_c1_r1'
    );
    expect(
      setupFindings(setup).some((item) => item.includes('controller'))
    ).toBe(true);
  });
  it('keeps templates portable and moves only the switch body', () => {
    const setup = defaultSetup();
    setup.template.switch.at = [2, 1];
    const doc = parse(compileSetup(setup));
    expect(doc.meta.studio.setup.template.switch.at).toEqual([2, 1]);
    expect(doc.layout.objects.fingers_c1_r1.placement).toBeUndefined();
    expect(doc.layout.objects.fingers_c1_r1.envelopes.body.at).toEqual([
      2, 1, 0,
    ]);
    expect(
      doc.layout.objects.fingers_c1_r1.footprints.switch.placement.at
    ).toEqual([2, 1, 0]);
  });
  it('creates separate boards and unique LED chains for mirrored halves', () => {
    const setup = defaultSetup();
    setup.topology = 'mirrored';
    setup.led = true;
    const doc = parse(compileSetup(setup));
    expect(Object.keys(doc.pcbs)).toEqual(['left', 'right']);
    expect(doc.layout.clusters.right_fingers.mirror.source).toBe(
      'left_fingers'
    );
    expect(
      doc.layout.clusters.right_fingers.overrides.left_fingers_c1_r1_led
        .footprints.main.params.P4
    ).toBe('right_LED_DATA');
  });
  it('reports pin exhaustion rather than silently omitting connections', () => {
    const setup = defaultSetup();
    setup.controller = 'nice_nano';
    setup.columns = 20;
    setup.rows = 20;
    expect(setupFindings(setup).join(' ')).toContain('GPIO');
  });
});

it('deletes a key and its owned components together', async () => {
  const { removeObject } = await import('./studioSource');
  const source = compileSetup(defaultSetup());
  const doc = parse(removeObject(source, 'objects', 'fingers_c1_r1'));
  expect(doc.layout.objects.fingers_c1_r1).toBeUndefined();
  expect(doc.layout.objects.fingers_c1_r1_diode).toBeUndefined();
});

it('duplicates owned electronics with independent local nets', async () => {
  const { duplicateObject } = await import('./studioSource');
  const doc = parse(
    duplicateObject(
      compileSetup(defaultSetup()),
      'objects',
      'fingers_c1_r1',
      'copy'
    )
  );
  expect(doc.layout.objects.copy_diode.properties.owner).toBe('copy');
  expect(doc.layout.objects.copy_diode.placement.ref).toBe('copy');
  expect(doc.layout.objects.copy_diode.footprints.main.params.from).toBe(
    'copy_switch'
  );
  expect(doc.layout.objects.copy_diode.footprints.main.params.to).toBe(
    'copy_row'
  );
});
it('duplicates a matrix with exactly one owned diode per copied key', async () => {
  const { duplicateObject } = await import('./studioSource');
  const doc = parse(
    duplicateObject(compileSetup(defaultSetup()), 'clusters', 'fingers', 'copy')
  );
  const copied = Object.entries(doc.layout.objects).filter(
    ([, item]: any) => item.cluster === 'copy'
  ) as [string, any][];
  const keys = copied.filter(([, item]) => item.kind === 'key');
  const diodes = copied.filter(([, item]) => item.properties?.role === 'diode');
  expect(keys).toHaveLength(20);
  expect(diodes).toHaveLength(20);
  for (const [id] of keys) {
    expect(
      diodes.filter(([, item]) => item.properties.owner === id)
    ).toHaveLength(1);
  }
});
