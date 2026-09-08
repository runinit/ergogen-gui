import { describe, it, expect } from 'vitest';
import { editDesign, movePoint } from './designSource';

describe('Design source edits', () => {
  it('changes a scalar without disturbing formulas, comments, or formatting', () => {
    const source =
      '# header\nunits: {pitch: 19} # keep\ndesigns:\n  regions:\n    keys:\n      size: [pitch - 1, 18]\n      close: 2 # close gaps\n';
    expect(editDesign(source, ['designs', 'regions', 'keys', 'close'], 3)).toBe(
      source.replace('close: 2', 'close: 3')
    );
  });
  it('adds a missing override while retaining inheritance and other text', () => {
    const source =
      'designs:\n  regions:\n    keys:\n      $extends: defaults\n      where: true # keep\npoints: {}\n';
    const changed = editDesign(
      source,
      ['designs', 'regions', 'keys', 'close'],
      2
    );
    expect(changed).toContain('$extends: defaults\n      where: true # keep\n');
    expect(changed).toContain('      close: 2\npoints: {}');
  });
  it('preserves coordinate formulas when dragging and rejects stale references', () => {
    const source =
      'designs:\n  sketches:\n    test:\n      points:\n        a: {at: [pitch, 0]} # anchor\n';
    expect(movePoint(source, 'test', 'a', [19, 0], [21, 3])).toContain(
      'at: [(pitch) + 2, 3]'
    );
    expect(() => movePoint(source, 'test', 'missing', [0, 0], [1, 1])).toThrow(
      'Missing'
    );
  });
});

it('does not move fixed points through visual dragging', () => {
  const source =
    'designs:\n  sketches:\n    test:\n      points:\n        a: {at: [0, 0], fixed: true}\n';
  expect(() => movePoint(source, 'test', 'a', [0, 0], [1, 1])).toThrow('fixed');
});

it('adds flow-map properties without rewriting neighboring source', () => {
  const source = 'designs:\n  regions:\n    keys: {where: true} # retain\n';
  expect(editDesign(source, ['designs', 'regions', 'keys', 'close'], 2)).toBe(
    'designs:\n  regions:\n    keys: {where: true, close: 2} # retain\n'
  );
});

it('drags an anchored point in its local frame without losing its formula', () => {
  const source =
    'designs:\n  sketches:\n    test:\n      points:\n        a: {anchor: {ref: thumb}, at: [pitch, 0]} # retain\n';
  expect(
    movePoint(source, 'test', 'a', [10, 20], [12, 20], {
      angle: 90,
      handedness: 1,
    })
  ).toBe(source.replace('at: [pitch, 0]', 'at: [pitch, -2]'));
});
