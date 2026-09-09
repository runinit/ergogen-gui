import { describe, expect, it } from 'vitest';
import { footprintUses, linkFootprint } from './footprintLinks';

describe('Explicit project library bindings', () => {
  it('links only the chosen declaration while preserving comments, inheritance and overrides', () => {
    const source =
      'pcbs:\n  board:\n    footprints:\n      a: # keep this\n        what: old\n        params: {side: B, height: "unit * 2"}\n      b:\n        what: old\n        $extends: pcbs.board.footprints.a\n';
    const uses = footprintUses(source);
    const changed = linkFootprint(source, uses[0], 'library/owned');
    expect(changed).toContain('a: # keep this');
    expect(changed).toContain('height: "unit * 2"');
    expect(changed).toContain('$extends: pcbs.board.footprints.a');
    expect(footprintUses(changed).map((use) => use.what)).toEqual([
      'library/owned',
      'old',
    ]);
    expect(() => linkFootprint(changed, uses[0], 'another')).toThrow(
      /changed/i
    );
  });
});
