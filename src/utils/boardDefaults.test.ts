import { parse } from 'yaml';
import { createBoard, applyBoardDefaults } from './boardDefaults';
import { defaultSetup } from './designSetup';
import { addCluster, removeObject } from './studioSource';
it('starts empty with explicit pitch and mechanical parameters', () => {
  const data = parse(createBoard({ ...defaultSetup(), pitch: 19, pitchY: 17 }));
  expect(data.layout.objects).toEqual({});
  expect(data.layout.clusters).toEqual({});
  expect(data.units).toMatchObject({ u: 19, v: 17, pcb_thickness: 1.6 });
  expect(data.designs.stackups.main.pcb).toBe('main');
});
it('applies defaults without regenerating deleted keys', () => {
  let source = createBoard(defaultSetup());
  source = addCluster(source, 'fingers', 'columns', { columns: 2, rows: 2 });
  const key = Object.keys(parse(source).layout.objects).find(
    (id) => !id.includes('diode')
  )!;
  source = removeObject(source, 'objects', key);
  const before = Object.keys(parse(source).layout.objects);
  const after = parse(
    applyBoardDefaults(source, { ...defaultSetup(), pitch: 19 })
  );
  expect(Object.keys(after.layout.objects)).toEqual(before);
  expect(after.units.u).toBe(19);
});

it('applies reversible footprints to existing keys', () => {
  const source = addCluster(createBoard(), 'keys', 'columns', {
    columns: 1,
    rows: 1,
  });
  const next = parse(
    applyBoardDefaults(source, { ...defaultSetup(), topology: 'reversible' })
  );
  const key = Object.values(next.layout.objects).find(
    (item: any) => item.kind === 'key'
  ) as any;
  expect(key.footprints.switch.params.reversible).toBe(true);
});

it('links matrices added after starting a mirrored board', () => {
  const source = addCluster(
    createBoard({ ...defaultSetup(), topology: 'mirrored' }),
    'keys',
    'columns',
    { columns: 2, rows: 1 }
  );
  const data = parse(source);
  const mirror = Object.values(data.layout.clusters).find(
    (item: any) => item.mirror
  ) as any;
  expect(mirror.mirror.source).toBe('keys');
  expect(
    Object.values(mirror.overrides).every((item: any) => item.pcb === 'right')
  ).toBe(true);
});

it.each(['single', 'mirrored'] as const)(
  'creates PCB outlines when an empty %s board receives keys',
  (topology) => {
    const source = addCluster(
      createBoard({ ...defaultSetup(), topology }),
      'keys',
      'columns',
      { columns: 2, rows: 2 }
    );
    const data = parse(source);
    for (const pcb of Object.values(data.pcbs) as { profile?: string }[]) {
      expect(pcb.profile).toMatch(/^profiles\./);
    }
  }
);
