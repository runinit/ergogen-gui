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
