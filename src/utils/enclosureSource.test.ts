import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createCase, editCase, removeCaseField } from './enclosureSource';

const source =
  '# Keep my layout\nunits: {pitch: 19}\npoints:\n  zones:\n    keys: {}\n';

describe('Enclosure source transactions', () => {
  it('creates a case without changing the original layout bytes', () => {
    const result = createCase(source, 'keyboard');
    expect(result.startsWith(source)).toBe(true);
    expect(parse(result).designs.assemblies.keyboard.preset).toBe('enclosure');
  });

  it('preserves formulas and custom fields when editing a supported value', () => {
    const initial = createCase(source, 'keyboard');
    const custom = editCase(initial, 'keyboard', ['wall'], 'pitch / 6');
    const result = editCase(custom, 'keyboard', ['mounting'], 'top');
    expect(result).toContain('pitch / 6');
    expect(result.startsWith(source)).toBe(true);
    expect(parse(result).designs.assemblies.keyboard.mounting).toBe('top');
  });

  it('rejects duplicate names and deletes only the chosen mount', () => {
    const initial = createCase(source, 'keyboard');
    expect(() => createCase(initial, 'keyboard')).toThrow(/exists/);
    const one = editCase(initial, 'keyboard', ['mounts', 'left'], {
      hole: 1,
      post: 3,
    });
    const two = editCase(one, 'keyboard', ['mounts', 'right'], {
      hole: 1,
      post: 3,
    });
    const result = removeCaseField(two, 'keyboard', ['mounts', 'left']);
    expect(parse(result).designs.assemblies.keyboard.mounts.right).toEqual({
      hole: 1,
      post: 3,
    });
    expect(
      parse(result).designs.assemblies.keyboard.mounts.left
    ).toBeUndefined();
  });
});

describe('Form selections', () => {
  it('toggles references without rewriting neighboring comments', async () => {
    const { toggleDesignRef } = await import('./enclosureSource');
    const source = 'items:\n  - a\n  - b # keep this\nother: untouched\n';
    const result = toggleDesignRef(source, ['items'], 'a');
    expect(result).toContain('- b # keep this');
    expect(result).toContain('other: untouched');
    expect(parse(result).items).toEqual(['b']);
    expect(
      parse(toggleDesignRef('items: [a, b]\n', ['items'], 'b')).items
    ).toEqual(['a']);
    expect(
      parse(toggleDesignRef('items:\n  - a\n', ['items'], 'a')).items
    ).toEqual([]);
  });
});

it('allows adding hardware after removing the final mount', () => {
  const initial = createCase(source, 'keyboard');
  const one = editCase(initial, 'keyboard', ['mounts', 'left'], {
    hole: 1,
    post: 3,
  });
  const empty = removeCaseField(one, 'keyboard', ['mounts', 'left']);
  const again = editCase(empty, 'keyboard', ['mounts', 'right'], {
    hole: 1,
    post: 3,
  });
  expect(parse(again).designs.assemblies.keyboard.mounts.right.hole).toBe(1);
});

it('requires mounting selection and stores a versioned CNC preset for new cases', () => {
  const source = createCase('points: {zones: {keys: {}}}\n', 'case');
  const spec = parse(source).designs.assemblies.case;
  expect(spec.mounting).toBe('');
  expect(spec.fit).toBe(0.5);
  expect(spec.manufacturing.bottom.material).toBe('Aluminium 6061');
});

it('updates a mounting object and its coordinates without rewriting adjacent comments', () => {
  const input =
    'designs:\n  assemblies:\n    case:\n      # Mount notes\n      mounts:\n        left:\n          anchor: {shift: [1, 2], rotate: 0}\n          hole: 1 # custom hole\n          post: 3\n      wall: 3 # preserve this\n';
  const result = editCase(input, 'case', ['mounts', 'left'], {
    anchor: { shift: [4, 5], rotate: 30 },
    hole: 1,
    post: 3,
    placement: { owner: 'manual' },
  });
  expect(
    parse(result).designs.assemblies.case.mounts.left.anchor.shift
  ).toEqual([4, 5]);
  expect(result).toContain('hole: 1 # custom hole');
  expect(result).toContain('wall: 3 # preserve this');
  expect(result).toContain('# Mount notes');
});

it('preserves a recent dimension edit while analysis still contains the previous placement', async () => {
  const { editCaseChanges } = await import('./enclosureSource');
  const before = { size: [10, 6], anchor: { shift: [0, 0] } };
  const draft = editCase(
    createCase(source, 'keyboard'),
    'keyboard',
    ['gaskets', 'left'],
    { ...before, size: [9, 6] }
  );
  const moved = editCaseChanges(
    draft,
    'keyboard',
    ['gaskets', 'left'],
    before,
    { ...before, anchor: { shift: [1, 0] } }
  );
  expect(parse(moved).designs.assemblies.keyboard.gaskets.left.size).toEqual([
    9, 6,
  ]);
  expect(
    parse(moved).designs.assemblies.keyboard.gaskets.left.anchor.shift
  ).toEqual([1, 0]);
});
