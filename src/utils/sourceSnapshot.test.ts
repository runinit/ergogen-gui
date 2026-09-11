import { sourceDocument, sourceValue } from './sourceSnapshot';
it('keeps cached reads isolated from callers and resolves aliases', () => {
  const source = 'base: &base {at: [1, 2, 3]}\ncopy: *base\n';
  const first = sourceValue(source, ['copy']) as { at: number[] };
  first.at[0] = 99;
  const doc = sourceDocument(source);
  doc.setIn(['base', 'at', 0], 88);
  expect(sourceValue(source, ['copy', 'at', 0])).toBe(1);
});
it('invalidates on source changes and rejects malformed YAML', () => {
  expect(sourceValue('value: 1', ['value'])).toBe(1);
  expect(sourceValue('value: 2', ['value'])).toBe(2);
  expect(() => sourceValue('value: [', ['value'])).toThrow();
});
