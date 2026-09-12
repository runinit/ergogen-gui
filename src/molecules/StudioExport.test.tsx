import { fireEvent, render, screen } from '@testing-library/react';
import StudioExport from './StudioExport';
import { createCase, editCase } from '../utils/enclosureSource';
import type { Results } from '../types/results';

const zip = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../utils/zip', () => ({ createZip: zip }));
const source = editCase(
  createCase('schema: ergogen/v1\nlayout: {objects: {}}', 'case'),
  'case',
  ['mounting'],
  'tray'
);
const geometry = {
  pcbs: { main: 'board' },
  solids: {
    bottom: {
      step: 'step',
      stl: new Uint8Array([1]),
      volume: 1,
      bounds: [
        [0, 0, 0],
        [1, 1, 1],
      ],
    },
  },
  designs: {
    assemblies: { case: { parts: {}, suggestions: [], manufacturing: [] } },
  },
} as unknown as Results;
const preview = {
  result: geometry,
  pending: false,
  stale: false,
  error: '',
  diagnostics: [],
  generate: vi.fn(),
  cancel: vi.fn(),
};
const props = {
  source,
  assets: {},
  result: geometry,
  stale: false,
  blockers: 0,
  review: vi.fn(),
  preview,
  analysis: preview,
};

it('exports generated case files after review without returning to the case editor', () => {
  render(<StudioExport {...props} />);
  const download = screen.getByRole('button', { name: 'Download case ZIP' });
  expect(download).toBeDisabled();
  fireEvent.click(
    screen.getByRole('checkbox', { name: /reviewed dimensions/i })
  );
  fireEvent.click(download);
  expect(zip).toHaveBeenCalledWith(
    geometry,
    source,
    undefined,
    false,
    true,
    {}
  );
});

it('invalidates case review on changes without blocking current PCB files', () => {
  const view = render(<StudioExport {...props} />);
  fireEvent.click(
    screen.getByRole('checkbox', { name: /reviewed dimensions/i })
  );
  view.rerender(
    <StudioExport {...props} preview={{ ...preview, stale: true }} />
  );
  expect(
    screen.getByRole('button', { name: 'Download case ZIP' })
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'main · KiCad PCB' })
  ).toBeEnabled();
  view.rerender(
    <StudioExport
      {...props}
      preview={{ ...preview, result: { ...geometry } }}
    />
  );
  expect(
    screen.getByRole('button', { name: 'Download case ZIP' })
  ).toBeDisabled();
});

it('never offers geometry downloads for an analysis result without outputs', () => {
  render(<StudioExport {...props} result={{ layout: {} } as Results} />);
  expect(
    screen.getByRole('button', { name: 'Download PCB and outlines ZIP' })
  ).toBeDisabled();
});

it('exports generated tray presets without requiring enclosure manufacturing fields', () => {
  const tray = {
    ...geometry,
    designs: {
      ...geometry.designs!,
      assemblies: { tray: geometry.designs!.assemblies.case },
    },
  };
  render(
    <StudioExport
      {...props}
      source={
        'schema: ergogen/v1\ndesigns: {assemblies: {tray: {preset: tray}}}'
      }
      preview={{ ...preview, result: tray }}
    />
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: /reviewed dimensions/i })
  );
  expect(
    screen.getByRole('button', { name: 'Download case ZIP' })
  ).toBeEnabled();
});
