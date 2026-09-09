import { it, expect } from 'vitest';
import { parse } from 'yaml';
import { editNativeBoard } from './nativeBoardSource';

it('updates body dimensions on the native instance used by stacking', () => {
  const source =
    'schema: ergogen/v1\nlayout: {objects: {mcu: {kind: component, part: controller}}}\n';
  const changed = editNativeBoard(source, ['board', 'components'], {
    mcu: { size: [18, 30], height: [0, 6] },
  })!;
  expect(parse(changed).layout.objects.mcu.envelopes.body.height).toEqual([
    0, 6,
  ]);
  expect(parse(changed).designs).toBeUndefined();
});
