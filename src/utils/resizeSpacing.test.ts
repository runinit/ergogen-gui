import { createHistory } from './projectHistory';
import { parse, stringify } from 'yaml';
import { compileSetup, defaultSetup } from './designSetup';
import { sizeSelection } from './studioSelection';
import { resolve } from 'ergogen/src/native/layout';
import { layoutSpacing, hasSpacing } from './snapSpacing';

const source = () =>
  compileSetup({ ...defaultSetup(), columns: 3, rows: 2, diode: false });
const column = (id: string) => ({
  section: 'columns' as const,
  cluster: 'fingers',
  id,
});
it.each(['c1', 'c2', 'c3'])('makes room for a 1.5u %s column', (id) => {
  const next = sizeSelection(source(), column(id), [27.525, 18]);
  const report = resolve(parse(next));
  expect(
    hasSpacing(
      report,
      [`fingers_${id}_r1`, `fingers_${id}_r2`],
      [0, 0],
      0,
      layoutSpacing(next, report)
    )
  ).toBe(true);
});
it('restores spacing after repeated grow and shrink', () => {
  let next = source();
  const before = resolve(parse(next));
  for (let i = 0; i < 3; i++) {
    next = sizeSelection(next, column('c2'), [27.525, 18]);
    next = sizeSelection(next, column('c2'), [18, 18]);
  }
  const after = resolve(parse(next));
  for (const id of Object.keys(before.objects)) {
    expect(after.objects[id].position).toEqual(before.objects[id].position);
  }
});
it.each([
  ['objects', 'fingers_c2_r1', [27.525, 18]],
  ['objects', 'fingers_c2_r2', [18, 37.05]],
  ['clusters', 'fingers', [27.525, 37.05]],
] as const)('clears %s resizing including taller keys', (section, id, size) => {
  const next = sizeSelection(source(), { section, id }, [...size]);
  const report = resolve(parse(next));
  for (const key of Object.values(report.objects).filter(
    (item) => item.kind === 'key'
  )) {
    expect(
      hasSpacing(report, [key.id], [0, 0], 0, layoutSpacing(next, report))
    ).toBe(true);
  }
});
it('preserves authored offset expressions across grow and shrink', () => {
  const original = source().replace('schema: ergogen/v1', 'schema: ergogen/v1');
  const doc = parse(original);
  doc.layout.objects.fingers_c1_r1.placement = {
    override: { at: ['pitch_x / 10', 3, 0] },
  };
  doc.units = { pitch_x: 19 };
  let next = stringify(doc);
  for (let i = 0; i < 2; i++) {
    next = sizeSelection(
      next,
      { section: 'objects', id: 'fingers_c1_r1' },
      [27.525, 18]
    );
    next = sizeSelection(
      next,
      { section: 'objects', id: 'fingers_c1_r1' },
      [18, 18]
    );
  }
  expect(
    parse(next).layout.objects.fingers_c1_r1.placement.override.at
  ).toEqual(['pitch_x / 10', 3, 0]);
});
it.each(['left', 'center', 'right'] as const)(
  'preserves explicit %s alignment while clearing neighbours',
  (x) => {
    const next = sizeSelection(source(), column('c2'), [27.525, 18], { x });
    const report = resolve(parse(next));
    expect(
      hasSpacing(
        report,
        ['fingers_c2_r1'],
        [0, 0],
        0,
        layoutSpacing(next, report)
      )
    ).toBe(true);
    expect(
      parse(next).layout.objects.fingers_c2_r1.properties.key_alignment.x
    ).toBe(x);
  }
);
it('respects locked downstream columns and records an export blocker', () => {
  const doc = parse(source());
  doc.layout.objects.fingers_c3_r1.locked = true;
  const next = sizeSelection(stringify(doc), column('c2'), [27.525, 18]);
  expect(
    parse(next).layout.objects.fingers_c2_r1.envelopes.keycap.size
  ).toEqual([27.525, 18]);
  expect(resolve(parse(next)).objects.fingers_c3_r1.position).toEqual(
    resolve(doc).objects.fingers_c3_r1.position
  );
  expect(
    parse(next).meta.studio.resizeSpacing.fingers.conflicts.length
  ).toBeGreaterThan(0);
});
it('retains splay, stagger and expressions in rotated matrices', () => {
  const doc = parse(source());
  doc.layout.clusters.fingers.placement = { at: [11, 7, 0], rotate: 35 };
  Object.assign(doc.layout.clusters.fingers.arrangement, {
    splay: { c2: 12 },
    stagger: { c2: 3 },
    offsets: { c3: ['pitch_x / 10', 2, 0] },
  });
  doc.units = { pitch_x: 19 };
  const next = sizeSelection(stringify(doc), column('c2'), [27.525, 18]);
  const report = resolve(parse(next));
  expect(report.clusters.fingers.position).toEqual(
    resolve(doc).clusters.fingers.position
  );
  expect(
    hasSpacing(
      report,
      ['fingers_c2_r1', 'fingers_c2_r2'],
      [0, 0],
      0,
      layoutSpacing(next, report)
    )
  ).toBe(true);
  const shrunk = parse(sizeSelection(next, column('c2'), [18, 18]));
  expect(shrunk.layout.clusters.fingers.arrangement.splay).toEqual({ c2: 12 });
  expect(shrunk.layout.clusters.fingers.arrangement.stagger).toEqual({ c2: 3 });
});
it('keeps mirrors and attached electronics in their native relationships', () => {
  const original = compileSetup({
    ...defaultSetup(),
    columns: 3,
    rows: 2,
    topology: 'mirrored',
  });
  const next = sizeSelection(
    original,
    { section: 'columns', cluster: 'left_fingers', id: 'c2' },
    [27.525, 18]
  );
  const before = resolve(parse(original)),
    after = resolve(parse(next));
  for (const id of ['left_fingers_c2_r1', 'left_fingers_c2_r1_diode']) {
    const mirror = `right_fingers__${id}`;
    expect(
      after.objects[mirror].position[0] - before.objects[mirror].position[0]
    ).toBeCloseTo(
      -(after.objects[id].position[0] - before.objects[id].position[0])
    );
  }
  expect(
    after.objects.right_fingers__left_fingers_c2_r1.envelopes.keycap.size
  ).toEqual([27.525, 18]);
});
it('keeps edited generated compensation as authored placement', () => {
  const grown = parse(sizeSelection(source(), column('c2'), [27.525, 18]));
  grown.layout.clusters.fingers.arrangement.offsets.c3 = [23, 4, 0];
  const shrunk = parse(sizeSelection(stringify(grown), column('c2'), [18, 18]));
  expect(shrunk.layout.clusters.fingers.arrangement.offsets.c3).toEqual([
    23, 4, 0,
  ]);
});
it('keeps constrained spacing unchanged and records the conflict', () => {
  const doc = parse(source());
  doc.layout.constraints = {
    fixed: {
      type: 'distance',
      refs: ['objects.fingers_c1_r1', 'objects.fingers_c2_r1'],
      value: 19,
    },
  };
  const next = sizeSelection(stringify(doc), column('c2'), [27.525, 18]);
  expect(
    parse(next).meta.studio.resizeSpacing.fingers.conflicts.length
  ).toBeGreaterThan(0);
  expect(resolve(parse(next)).objects.fingers_c2_r1.position).toEqual(
    resolve(doc).objects.fingers_c2_r1.position
  );
});
it('rejects an anchor shift that moves a locked attachment atomically', () => {
  const doc = parse(
    compileSetup({ ...defaultSetup(), columns: 3, rows: 2, diode: true })
  );
  doc.layout.objects.fingers_c1_r1_diode.locked = true;
  expect(() =>
    sizeSelection(stringify(doc), column('c1'), [27.525, 18])
  ).toThrow(/locked/);
});
it('saves size and spacing in a single undoable edit', () => {
  const before = source(),
    history = createHistory(before);
  const after = sizeSelection(before, column('c2'), [27.525, 18]);
  history.record(after);
  expect(history.undo()).toBe(before);
  expect(history.canUndo).toBe(false);
  expect(history.redo()).toBe(after);
  expect(
    resolve(parse(stringify(parse(after)))).objects.fingers_c3_r1.position
  ).toEqual(resolve(parse(after)).objects.fingers_c3_r1.position);
});
it('retains generated spacing when a downstream key is locked after growth', () => {
  const grown = parse(sizeSelection(source(), column('c2'), [27.525, 18]));
  grown.layout.objects.fingers_c3_r1.locked = true;
  const before = resolve(grown).objects.fingers_c3_r1.position;
  const next = sizeSelection(stringify(grown), column('c2'), [18, 18]);
  expect(resolve(parse(next)).objects.fingers_c3_r1.position).toEqual(before);
  expect(
    parse(next).layout.objects.fingers_c2_r1.envelopes.keycap.size
  ).toEqual([18, 18]);
});
it('reports a resized outside anchor driven by an authored constraint', () => {
  const doc = parse(source());
  doc.layout.constraints = {
    anchored: {
      type: 'distance',
      refs: ['objects.fingers_c1_r1', 'objects.fingers_c1_r2'],
      value: 19.05,
    },
  };
  const next = sizeSelection(
    stringify(doc),
    { section: 'objects', id: 'fingers_c1_r1' },
    [27.525, 18]
  );
  expect(
    parse(next).meta.studio.resizeSpacing.fingers.conflicts.length
  ).toBeGreaterThan(0);
});
it('leaves external keys in place and reports blocked clearance', () => {
  const doc = parse(source());
  doc.layout.objects.external = {
    kind: 'key',
    part: doc.layout.objects.fingers_c1_r1.part,
    pcb: 'main',
    layer: 'main',
    placement: { at: [-28, 0, 0] },
  };
  const before = resolve(doc).objects.external.position;
  const next = sizeSelection(stringify(doc), column('c1'), [27.525, 18]);
  expect(resolve(parse(next)).objects.external.position).toEqual(before);
  expect(
    parse(next).meta.studio.resizeSpacing.fingers.conflicts.length
  ).toBeGreaterThan(0);
});
