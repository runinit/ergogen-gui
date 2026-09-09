import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { moveLayout, setLayout } from './layoutSource';

const source = `# Keep this document\nschema: ergogen/v1\nunits: {pitch: 19}\nlayout:\n  objects:\n    thumb:\n      kind: key\n      placement: {at: [pitch, 0, 0]} # Keep this formula\n`;
const frame = [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('Native layout transactions', () => {
  it('stores local movement without replacing the driven position', () => {
    const result = moveLayout(source, 'objects', 'thumb', [0, 5, 0], frame);
    const value = parse(result).layout.objects.thumb;
    expect(value.placement.at).toEqual(['pitch', 0, 0]);
    expect(value.placement.override.at).toEqual([5, 0, 0]);
    expect(result).toContain('# Keep this formula');
    expect(result).toContain('# Keep this document');
  });

  it('rejects edits to locked objects', () => {
    const locked = setLayout(source, 'objects', 'thumb', ['locked'], true);
    expect(() => moveLayout(locked, 'objects', 'thumb', [1, 0, 0])).toThrow(
      /locked/
    );
  });
});

it('stores a mirrored member edit in that cluster and respects the source cluster lock', () => {
  const source = `schema: ergogen/v1
layout:
  clusters:
    left: {locked: true}
    right: {mirror: {source: left, axis: 50}}
  objects:
    key: {kind: key, cluster: left}
`;
  expect(() => moveLayout(source, 'objects', 'key', [1, 0, 0])).toThrow(
    /locked/
  );
  const changed = moveLayout(source, 'objects', 'right__key', [2, 0, 0]);
  expect(changed).toContain('key: {kind: key, cluster: left}');
  expect(
    parse(changed).layout.clusters.right.overrides.key.placement.override.at
  ).toEqual([2, 0, 0]);
});

it('materializes only the moved alias instance', () => {
  const input =
    'schema: ergogen/v1\nlayout:\n  objects:\n    left: &key {kind: key, placement: {at: [19, 0, 0]}}\n    right: *key # keep\n';
  const changed = moveLayout(input, 'objects', 'right', [2, 0, 0]);
  expect(changed).toContain(
    'left: &key {kind: key, placement: {at: [19, 0, 0]}}'
  );
  expect(parse(changed).layout.objects.left.placement.override).toBeUndefined();
  expect(parse(changed).layout.objects.right.placement.override.at).toEqual([
    2, 0, 0,
  ]);
});
