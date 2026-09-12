import { parse } from 'yaml';
import { createBoard } from './boardDefaults';
import { addCluster, setValue } from './studioSource';
import { mergeSetupDraft } from './setupDraft';
it('merges material edits without replacing a newly placed matrix', () => {
  const base = createBoard();
  const draft = setValue(base, ['units', 'plate_gap'], 4);
  const current = addCluster(base, 'fingers', 'columns', {
    columns: 2,
    rows: 1,
  });
  const next = parse(mergeSetupDraft(base, draft, current));
  expect(Object.keys(next.layout.objects)).toEqual(
    Object.keys(parse(current).layout.objects)
  );
  expect(next.units.plate_gap).toBe(4);
  expect(() =>
    mergeSetupDraft(base, draft, setValue(current, ['units', 'plate_gap'], 7))
  ).toThrow(/changed while setup/);
});
