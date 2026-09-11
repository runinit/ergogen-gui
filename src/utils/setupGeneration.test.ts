import { expect, it } from 'vitest';
import * as ergogen from 'ergogen';
import bundled from '../../.generated/footprints.json';
import extras from '../catalogue/footprints.json';
import { createInjectionModule } from './injectionEvaluator';
import { defaultSetup, compileSetup } from './designSetup';
for (const [name, source] of Object.entries({ ...bundled, ...extras })) {
  ergogen.inject('footprint', name, createInjectionModule(source));
}
it.each(['single', 'mirrored', 'reversible'] as const)(
  'compiles %s topology with owned components',
  async (topology) => {
    const setup = defaultSetup();
    setup.topology = topology;
    setup.columns = 2;
    setup.rows = 2;
    setup.controller = 'nice_nano';
    setup.led = true;
    const result = await ergogen.process(compileSetup(setup), {
      analysis: true,
    });
    expect(
      Object.values(result.pcbs).every((board: any) =>
        board.includes('Nice_Nano_V2.step')
      )
    ).toBe(true);
    expect(Object.keys(result.pcbs)).toHaveLength(
      topology === 'mirrored' ? 2 : 1
    );
    expect(
      Object.values(result.layout.objects).filter(
        (item: any) => item.kind === 'key'
      )
    ).toHaveLength(topology === 'mirrored' ? 8 : 4);
    expect(
      Object.values(result.pcbs).every((board: any) => board.includes('SK6812'))
    ).toBe(true);
  }
);
it('supports an incomplete layout without electronics', async () => {
  const setup = defaultSetup();
  setup.diode = false;
  setup.columns = 2;
  setup.rows = 1;
  const result = await ergogen.process(compileSetup(setup), { analysis: true });
  expect(Object.keys(result.layout.objects)).toHaveLength(2);
});

it('compiles the pinned Pico module with assigned header pins and portable model', async () => {
  const setup = defaultSetup();
  setup.controller = 'pico';
  setup.columns = 2;
  setup.rows = 2;
  const result = await ergogen.process(compileSetup(setup), { analysis: true });
  expect(result.pcbs.main).toContain(
    '${KIPRJMOD}/models/RaspberryPi_Pico.step'
  );
  expect(result.pcbs.main).toContain('GND');
});

it('compiles the XIAO RP2040 module', async () => {
  const setup = defaultSetup();
  setup.controller = 'xiao_rp2040';
  setup.columns = 2;
  setup.rows = 2;
  const result = await ergogen.process(compileSetup(setup), { analysis: true });
  expect(result.pcbs.main).toContain('seeeduino_xiao_rp2040.step');
});
it('places back-mounted diode bodies below the PCB', async () => {
  const setup = { ...defaultSetup(), columns: 2, rows: 2 };
  const result = await ergogen.process(compileSetup(setup), { analysis: true });
  expect(
    result.layout.findings.filter((finding: any) =>
      finding.message.includes('physical envelope overlap')
    )
  ).toEqual([]);
  expect(
    result.layout.objects.fingers_c1_r1_diode.envelopes.body.height[1]
  ).toBeLessThan(0);
});
