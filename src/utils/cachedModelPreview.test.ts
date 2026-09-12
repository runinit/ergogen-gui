import { expect, it } from 'vitest';
import { modelPreview } from './cachedModelPreview';
it('finds a preview by portable path when a binding has no asset id', () => {
  const preview = JSON.stringify({ stl: 'mesh' });
  expect(
    modelPreview(
      { path: '${KIPRJMOD}/models/nested/part.wrl' },
      { 'nested/part.wrl': '#VRML', '__model_nested/part.wrl.json': preview }
    )
  ).toBe(preview);
});
it('keeps equal filenames in separate directories distinct', () => {
  const assets = {
    'one/part.wrl': '#VRML',
    'two/part.wrl': '#VRML',
    '__model_one/part.wrl.json': 'one',
    '__model_two/part.wrl.json': 'two',
  };
  expect(
    modelPreview({ path: '${KIPRJMOD}/models/two/part.wrl' }, assets)
  ).toBe('two');
});
it('leaves ambiguous filenames unresolved without crashing the editor', () => {
  expect(
    modelPreview(
      { path: 'part.wrl' },
      { 'one/part.wrl': 'a', 'two/part.wrl': 'b' }
    )
  ).toBeUndefined();
});
