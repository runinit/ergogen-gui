import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { exampleOptions } from './index';
import BHK from './bhk';

// Source from the published pre-enclosure revision 3c30c6b.
const ORIGINAL_BHK_SHA256 =
  'aa2ef4bdaefe90d23c4abb7a75576f17a0ac231a9d8d4878cf63089a7166baa4';

it('offers the original BHK design without a migrated replacement', () => {
  const examples = exampleOptions.flatMap((group) => group.options);
  expect(examples.filter((example) => /bhk/i.test(example.label))).toEqual([
    BHK,
  ]);
  expect(createHash('sha256').update(BHK.value).digest('hex')).toBe(
    ORIGINAL_BHK_SHA256
  );
  const config = parse(BHK.value);
  expect(config.designs).toBeUndefined();
  expect(Object.keys(config.outlines)).toEqual(
    expect.arrayContaining(['bhk', 'bhk_plate', 'bhk_auto', 'preview'])
  );
  expect(config.pcbs.bhk_pcb.outlines.board.outline).toBe('bhk');
});
