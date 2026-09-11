import { parse } from 'yaml';
import { removeSelection, isDeleteShortcut } from './studioDelete';
const source = `schema: ergogen/v1
layout:
  clusters: {main: {arrangement: {type: columns, columns: [c1,c2], rows: [r1]}}}
  objects:
    a: {kind: key, cluster: main, cell: [c1,r1]}
    b: {kind: key, cluster: main, cell: [c2,r1]}
    diode: {kind: component, properties: {owner: a}, placement: {ref: a}}
    encoder: {kind: component, placement: {ref: b}}
`;
it('deletes a column and owned electronics while keeping other columns', () => {
  const result = parse(
    removeSelection(source, { section: 'columns', cluster: 'main', id: 'c1' })
  );
  expect(Object.keys(result.layout.objects)).toEqual(['b', 'encoder']);
  expect(result.layout.clusters.main.arrangement.columns).toEqual(['c2']);
});
it('removes selected dependents before their parent as one source change', () => {
  const result = parse(
    removeSelection(source, {
      section: 'objects',
      id: 'encoder',
      members: [
        { section: 'objects', id: 'b' },
        { section: 'objects', id: 'encoder' },
      ],
    })
  );
  expect(Object.keys(result.layout.objects)).toEqual(['a', 'diode']);
});
it('protects locks and external references', () => {
  expect(() =>
    removeSelection(source, { section: 'objects', id: 'b' })
  ).toThrow(/Used by/);
  expect(() =>
    removeSelection(source.replace('diode: {', 'diode: {locked: true,'), {
      section: 'clusters',
      id: 'main',
    })
  ).toThrow(/Unlock/);
});
it('leaves Delete alone in editable fields and dialogs', () => {
  for (const html of [
    '<input>',
    '<textarea></textarea>',
    '<select></select>',
    '<div contenteditable="true"><span></span></div>',
    '<div role="dialog"><button></button></div>',
  ]) {
    const host = document.createElement('div');
    host.innerHTML = html;
    const target = host.querySelector('span,button') || host.firstElementChild;
    expect(isDeleteShortcut('Delete', target)).toBe(false);
  }
  expect(isDeleteShortcut('Delete', document.createElement('button'))).toBe(
    true
  );
  expect(isDeleteShortcut('Backspace', document.createElement('button'))).toBe(
    false
  );
});
