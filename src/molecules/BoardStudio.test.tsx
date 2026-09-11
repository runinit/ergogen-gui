import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { parse } from 'yaml';
import { compileSetup, defaultSetup } from '../utils/designSetup';
import { setValue } from '../utils/studioSource';
import BoardStudio from './BoardStudio';
import {
  useLayoutAnalysis,
  useCaseAnalysis,
  useCasePreview,
} from '../hooks/useCasePreview';

let current = '';
const hooks = vi.hoisted(() => ({ useConfigContext: vi.fn() }));
vi.mock('../context/ConfigContext', () => hooks);
vi.mock('../hooks/useCasePreview', () => ({
  useCasePreview: vi.fn(() => ({
    result: null,
    stale: true,
    pending: false,
    error: '',
    diagnostics: [],
    generate: vi.fn(),
    cancel: vi.fn(),
  })),
  useLayoutAnalysis: vi.fn(() => ({
    result: null,
    stale: true,
    pending: false,
    error: '',
  })),
  useCaseAnalysis: vi.fn(() => ({
    result: { layout: { objects: {}, clusters: {}, layers: {}, findings: [] } },
    diagnostics: [],
    error: '',
    pending: false,
    stale: false,
  })),
}));
vi.mock('./StudioCanvas', () => ({
  default: ({
    stale,
    report,
  }: {
    stale: boolean;
    report?: { objects: Record<string, unknown> };
  }) => (
    <div aria-label="Layout canvas" data-stale={String(stale)}>
      {Object.keys(report?.objects || {}).join(',')}
    </div>
  ),
}));
vi.mock('../utils/caseAssets', () => ({ loadAssets: async () => ({}) }));
vi.mock('./ConfigEditor', () => ({ default: () => <div>Code editor</div> }));
vi.mock('./FootprintLibrary', () => ({
  default: ({ onPreview }: { onPreview: () => void }) => (
    <button onClick={onPreview}>Preview in case</button>
  ),
}));
vi.mock('./CaseWizard', () => ({ default: () => <div>Case tools</div> }));
vi.mock('./FilePreview', () => ({ default: () => <div>PCB viewer</div> }));
function Harness({ initial }: { initial?: string }) {
  const [source, setSource] = useState(
    initial || 'schema: ergogen/v1\nunits: {pitch: 19}\nlayout: {objects: {}}\n'
  );
  current = source;
  hooks.useConfigContext.mockReturnValue({
    configInput: source,
    getRealtimeConfigInput: () => source,
    editSource: setSource,
    activeConfigName: 'Test board',
    injectionInput: [],
    setCadActive: vi.fn(),
    setShowSideNav: vi.fn(),
    setShowSettings: vi.fn(),
    canUndo: false,
    canRedo: false,
  });
  return <BoardStudio />;
}
it('creates and edits a parametric thumb cluster without opening Code', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.change(screen.getByLabelText('New item kind'), {
    target: { value: 'arc' },
  });
  fireEvent.change(screen.getByLabelText('New item name'), {
    target: { value: 'thumbs' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(parse(current).layout.clusters.thumbs.arrangement.type).toBe('arc');
  expect(Object.keys(parse(current).layout.objects)).toHaveLength(3);
  fireEvent.blur(screen.getByLabelText('Radius'), {
    target: { value: 'pitch * 2' },
  });
  expect(parse(current).layout.clusters.thumbs.arrangement.radius).toBe(
    'pitch * 2'
  );
  fireEvent.click(screen.getByLabelText('Solve x'));
  expect(parse(current).layout.clusters.thumbs.placement.solve).toEqual(['x']);
  expect(screen.queryByText('Code editor')).not.toBeInTheDocument();
});
it('keeps workflow destinations and code accessible', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Case' }));
  expect(screen.getByText('Case tools')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  expect(screen.getByText('Code editor')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  expect(screen.getByRole('button', { name: 'Download YAML' })).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Download PCB and outlines ZIP' })
  ).toBeDisabled();
});

it('uses the same generation controller across case and export navigation', () => {
  const generate = vi.fn();
  vi.mocked(useCasePreview).mockReturnValue({
    result: null,
    stale: true,
    pending: false,
    error: '',
    diagnostics: [],
    generate,
    cancel: vi.fn(),
  });
  vi.mocked(useLayoutAnalysis).mockReturnValue({
    result: null,
    stale: false,
    pending: false,
    error: '',
    diagnostics: [],
    generate: vi.fn(),
    cancel: vi.fn(),
  });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate project' }));
  expect(generate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Case' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate project' }));
  expect(generate).toHaveBeenCalledTimes(2);
});
it('creates a 5 by 4 matrix and edits a whole column and its individual cells', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.change(screen.getByLabelText('New item name'), {
    target: { value: 'matrix' },
  });
  expect(screen.getByLabelText('New matrix columns')).toHaveValue(5);
  expect(screen.getByLabelText('New matrix rows')).toHaveValue(4);
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(Object.keys(parse(current).layout.objects)).toHaveLength(20);
  fireEvent.click(screen.getAllByRole('button', { name: 'Column 2 · c2' })[0]);
  fireEvent.blur(screen.getByLabelText('Column splay'), {
    target: { value: '8' },
  });
  expect(parse(current).layout.clusters.matrix.arrangement.splay.c2).toBe(8);
  fireEvent.click(screen.getByRole('button', { name: 'Remove matrix_c2_r1' }));
  expect(parse(current).layout.objects.matrix_c2_r1).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Add key in row 1' }));
  expect(parse(current).layout.objects.matrix_c2_r1.cell).toEqual(['c2', 'r1']);
  expect(parse(current).layout.objects.matrix_c2_r1.properties).toBeUndefined();
});
it('shows authored cluster counts even before outline analysis succeeds', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.change(screen.getByLabelText('New item name'), {
    target: { value: 'thumbs' },
  });
  fireEvent.change(screen.getByLabelText('New item kind'), {
    target: { value: 'arc' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(screen.getByRole('button', { name: 'thumbs 3 keys' })).toBeVisible();
});
it('keeps an empty free cluster selectable and deletable', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.change(screen.getByLabelText('New item name'), {
    target: { value: 'free' },
  });
  fireEvent.change(screen.getByLabelText('New item kind'), {
    target: { value: 'free' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(screen.getByRole('button', { name: 'free 0 keys' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(parse(current).layout.clusters.free).toBeUndefined();
});

it('keeps fresh layout geometry editable when board analysis fails', () => {
  vi.mocked(useLayoutAnalysis).mockReturnValueOnce({
    result: {
      layout: {
        objects: { new_key: { kind: 'key' } },
        clusters: {},
        findings: [],
      },
    },
    stale: false,
    pending: false,
    error: '',
    diagnostics: [],
  } as unknown as ReturnType<typeof useLayoutAnalysis>);
  vi.mocked(useCaseAnalysis).mockReturnValueOnce({
    result: null,
    stale: true,
    pending: false,
    error: 'Disconnected outline',
    diagnostics: [],
  } as unknown as ReturnType<typeof useCaseAnalysis>);
  render(<Harness />);
  expect(screen.getByLabelText('Layout canvas')).toHaveTextContent('new_key');
  expect(screen.getByLabelText('Layout canvas')).toHaveAttribute(
    'data-stale',
    'false'
  );
});
it('keeps board exports stale when only layout resolution succeeds', () => {
  vi.mocked(useLayoutAnalysis).mockReturnValue({
    result: { layout: { objects: {}, clusters: {}, findings: [] } },
    stale: false,
    pending: false,
    error: '',
    diagnostics: [],
  } as unknown as ReturnType<typeof useLayoutAnalysis>);
  vi.mocked(useCaseAnalysis).mockReturnValue({
    result: null,
    stale: true,
    pending: false,
    error: 'Disconnected outline',
    diagnostics: [],
  } as unknown as ReturnType<typeof useCaseAnalysis>);
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  expect(
    screen.getByRole('button', { name: 'Download PCB and outlines ZIP' })
  ).toBeDisabled();
});

it('opens the case from the footprint library preview action', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Part library' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Preview in case' })
  );
  expect(screen.getByText('Case tools')).toBeInTheDocument();
});

it('reviews an edited column removal and preserves the source on Cancel', () => {
  const source = setValue(
    compileSetup({ ...defaultSetup(), columns: 2, rows: 1 }),
    ['layout', 'objects', 'fingers_c2_r1', 'placement'],
    { override: { at: [2, 0, 0] } }
  );
  render(<Harness initial={source} />);
  fireEvent.click(screen.getByRole('button', { name: 'fingers 2 keys' }));
  fireEvent.blur(screen.getByLabelText('Matrix columns'), {
    target: { value: '1' },
  });
  expect(
    screen.getByRole('dialog', { name: 'Review matrix resize' })
  ).toBeVisible();
  expect(current).toBe(source);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(current).toBe(source);
  expect(screen.getByLabelText('Matrix columns')).toHaveValue(2);
  fireEvent.blur(screen.getByLabelText('Matrix columns'), {
    target: { value: '1' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove keys and resize' })
  );
  const objects = parse(current).layout.objects;
  expect(objects.fingers_c2_r1).toBeUndefined();
  expect(objects.fingers_c2_r1_diode).toBeUndefined();
  expect(parse(current).layout.clusters.fingers.arrangement.columns).toEqual([
    'c1',
  ]);
});

it('deletes the selected column but leaves Delete in text fields alone', () => {
  vi.mocked(useLayoutAnalysis).mockReturnValue({
    result: { layout: { objects: {}, clusters: {}, findings: [] } },
    pending: false,
    stale: false,
    error: '',
    diagnostics: [],
  } as unknown as ReturnType<typeof useLayoutAnalysis>);
  render(
    <Harness
      initial={
        'schema: ergogen/v1\nlayout: {clusters: {main: {arrangement: {type: columns, columns: [c1,c2], rows: [r1]}}}, objects: {a: {kind: key, cluster: main, cell: [c1,r1]}, b: {kind: key, cluster: main, cell: [c2,r1]}}}'
      }
    />
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Column 1 · c1' })[0]);
  const before = current;
  fireEvent.keyDown(screen.getByLabelText('Column splay'), { key: 'Delete' });
  expect(current).toBe(before);
  fireEvent.keyDown(screen.getByRole('region', { name: 'Board Studio' }), {
    key: 'Delete',
  });
  expect(Object.keys(parse(current).layout.objects)).toEqual(['b']);
  expect(parse(current).layout.clusters.main.arrangement.columns).toEqual([
    'c2',
  ]);
});

it('keeps cancellation available while Case is generating', () => {
  const cancel = vi.fn();
  vi.mocked(useCasePreview).mockReturnValue({
    result: null,
    stale: true,
    pending: true,
    error: '',
    diagnostics: [],
    generate: vi.fn(),
    cancel,
  });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Case' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel generation' }));
  expect(cancel).toHaveBeenCalledOnce();
});

it('retries failed board analysis from Export', () => {
  const generate = vi.fn();
  vi.mocked(useCaseAnalysis).mockReturnValue({
    result: null,
    stale: true,
    pending: false,
    error: 'Worker stopped',
    diagnostics: [],
    generate,
    cancel: vi.fn(),
  });
  vi.mocked(useCasePreview).mockReturnValue({
    result: null,
    stale: true,
    pending: false,
    error: '',
    diagnostics: [],
    generate: vi.fn(),
    cancel: vi.fn(),
  });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry board analysis' }));
  expect(generate).toHaveBeenCalledOnce();
});

it('returns to the part library after closing Code', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Part library' }));
  expect(
    await screen.findByRole('button', { name: 'Preview in case' })
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  expect(screen.getByText('Code editor')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Code' }));
  expect(
    await screen.findByRole('button', { name: 'Preview in case' })
  ).toBeVisible();
});

it('opens case creation from Export when the project has no assembly', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Review case and manufacturing' })
  );
  expect(screen.getByText('Case tools')).toBeVisible();
});
