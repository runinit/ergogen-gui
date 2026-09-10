import { render, screen, fireEvent } from '@testing-library/react';
import { parse } from 'yaml';
import StudioInspector from './StudioInspector';
import { readStudio } from '../utils/studioSource';
it('edits multiple outline sources as a list', () => {
  let source =
    'schema: ergogen/v1\nlayout: {}\ndesigns: {profiles: {board: {from: [regions.keys, regions.parts]}}}\n';
  render(
    <StudioInspector
      source={source}
      data={readStudio(source)}
      selection={{ section: 'outline', id: 'board' }}
      edit={(change) => {
        source = change(source);
      }}
      select={() => {}}
    />
  );
  fireEvent.blur(screen.getByLabelText('Sources'), {
    target: { value: 'regions.keys, regions.support' },
  });
  expect(parse(source).designs.profiles.board.from).toEqual([
    'regions.keys',
    'regions.support',
  ]);
});
it('changes the boundary that owns BHK corner finishing', () => {
  let source =
    'schema: ergogen/v1\nlayout: {}\ndesigns: {profiles: {board: {from: boundaries.edge}}, boundaries: {edge: {from: regions.keys, corners: {fillet: 3}}}}\n';
  render(
    <StudioInspector
      source={source}
      data={readStudio(source)}
      selection={{ section: 'outline', id: 'board' }}
      edit={(change) => {
        source = change(source);
      }}
      select={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText('Outline corners'), {
    target: { value: 'chamfer' },
  });
  expect(parse(source).designs.boundaries.edge.corners).toEqual({ chamfer: 3 });
  expect(parse(source).designs.profiles.board.corners).toBeUndefined();
});
it('offers key presets without resizing the switch opening or other keys', () => {
  let source =
    'schema: ergogen/v1\nparts: {mx: {envelopes: {keycap: {size: [18, 18]}, plate: {size: [14, 14]}}}}\nlayout: {objects: {a: {kind: key, part: mx}, b: {kind: key, part: mx}}}\n';
  render(
    <StudioInspector
      source={source}
      data={readStudio(source)}
      selection={{ section: 'objects', id: 'a' }}
      edit={(change) => {
        source = change(source);
      }}
      select={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText('Key size preset'), {
    target: { value: 'mx-2' },
  });
  expect(parse(source).layout.objects.a.envelopes.keycap.size).toEqual([
    37.05, 18,
  ]);
  expect(parse(source).parts.mx.envelopes.plate.size).toEqual([14, 14]);
  expect(parse(source).layout.objects.a.placement.override.at).toEqual([
    9.525, 0, 0,
  ]);
  expect(parse(source).layout.objects.b.envelopes).toBeUndefined();
});
it('edits width then depth while preserving the other dimension', () => {
  let source =
    'schema: ergogen/v1\nparts: {mx: {envelopes: {keycap: {size: [18, 18]}}}}\nlayout: {objects: {a: {kind: key, part: mx}}}\n';
  render(
    <StudioInspector
      source={source}
      data={readStudio(source)}
      selection={{ section: 'objects', id: 'a' }}
      edit={(change) => {
        source = change(source);
      }}
      select={() => {}}
    />
  );
  fireEvent.blur(screen.getByLabelText('Key width'), {
    target: { value: '24' },
  });
  fireEvent.blur(screen.getByLabelText('Key depth'), {
    target: { value: '27' },
  });
  expect(parse(source).layout.objects.a.envelopes.keycap.size).toEqual([
    24, 27,
  ]);
  expect(parse(source).layout.objects.a.placement.override.at).toEqual([
    3, -4.5, 0,
  ]);
});
it('shows and edits existing key offsets without resetting other axes', () => {
  let source =
    'schema: ergogen/v1\nlayout: {objects: {a: {kind: key, placement: {override: {at: [10, 4, 0], rotate: 15}}}}}\n';
  render(
    <StudioInspector
      source={source}
      data={readStudio(source)}
      selection={{ section: 'objects', id: 'a' }}
      edit={(change) => {
        source = change(source);
      }}
      select={() => {}}
    />
  );
  expect(screen.getByLabelText('X')).toHaveValue('10');
  expect(screen.getByLabelText('Rotation')).toHaveValue('15');
  fireEvent.blur(screen.getByLabelText('X'), { target: { value: '12' } });
  expect(parse(source).layout.objects.a.placement.override.at).toEqual([
    12, 4, 0,
  ]);
});
