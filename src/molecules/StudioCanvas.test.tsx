import { act, fireEvent, render, screen } from '@testing-library/react';
import type { LayoutReport } from 'ergogen/src/native';
import StudioCanvas from './StudioCanvas';
import { useLayoutAnalysis } from '../hooks/useCasePreview';
import { process as generate } from 'ergogen';

vi.mock('../hooks/useCasePreview', () => ({
  useLayoutAnalysis: vi.fn(() => ({ pending: false, stale: true, error: '' })),
}));
const report = {
  objects: {
    key: {
      id: 'key',
      label: 'key',
      kind: 'key',
      position: [0, 0, 0],
      cluster: 'fingers',
      cell: ['c1', 'r1'],
      envelopes: { keycap: { size: [18, 18] } },
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    },
  },
  clusters: {},
  layers: {},
  findings: [],
} as unknown as LayoutReport;
it('keeps the viewport stable while selecting a column to move', () => {
  const select = vi.fn();
  Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => null,
  });
  try {
    render(
      <StudioCanvas
        report={report}
        selection={{ section: 'columns', id: 'c1', cluster: 'fingers' }}
        onSelect={select}
        onMove={vi.fn()}
        stale={false}
        source=""
        side="top"
        onSide={vi.fn()}
        rules={{}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select Columns' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Select key' }));
    expect(select).toHaveBeenLastCalledWith(
      { section: 'columns', id: 'c1', cluster: 'fingers' },
      'keep'
    );
    fireEvent.pointerCancel(
      screen.getByRole('group', { name: 'Interactive board layout' })
    );
  } finally {
    Reflect.deleteProperty(SVGSVGElement.prototype, 'setPointerCapture');
    Reflect.deleteProperty(SVGSVGElement.prototype, 'getScreenCTM');
  }
});

it('starts an object move in Select mode without changing tools', () => {
  const select = vi.fn();
  Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => null,
  });
  try {
    render(
      <StudioCanvas
        report={report}
        selection={{ section: 'objects', id: '' }}
        onSelect={select}
        onMove={vi.fn()}
        stale={false}
        source=""
        side="top"
        onSide={vi.fn()}
        rules={{}}
      />
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Select key' }));
    expect(select).toHaveBeenCalledWith(
      { section: 'objects', id: 'key' },
      'keep'
    );
    expect(screen.getByRole('status')).toHaveTextContent(/drag/i);
  } finally {
    Reflect.deleteProperty(SVGSVGElement.prototype, 'setPointerCapture');
    Reflect.deleteProperty(SVGSVGElement.prototype, 'getScreenCTM');
  }
});

it('keeps the camera fixed when a dropped object changes the layout bounds', () => {
  Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => null,
  });
  try {
    const props = {
      selection: { section: 'objects' as const, id: 'key' },
      onSelect: vi.fn(),
      onMove: vi.fn(),
      stale: false,
      source: '',
      side: 'top' as const,
      onSide: vi.fn(),
      rules: {},
    };
    const view = render(<StudioCanvas {...props} report={report} />);
    const svg = screen.getByRole('group', { name: 'Interactive board layout' });
    const before = svg.getAttribute('viewBox');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Select key' }));
    fireEvent.pointerUp(svg);
    const matrix = [...report.objects.key.matrix];
    matrix[3] = 20;
    view.rerender(
      <StudioCanvas
        {...props}
        report={{
          ...report,
          objects: {
            key: { ...report.objects.key, matrix, position: [20, 0, 0] },
          },
        }}
      />
    );
    expect(svg.getAttribute('viewBox')).toBe(before);
  } finally {
    Reflect.deleteProperty(SVGSVGElement.prototype, 'setPointerCapture');
    Reflect.deleteProperty(SVGSVGElement.prototype, 'getScreenCTM');
  }
});

it('holds the validated drop while the main report is stale', async () => {
  const source =
    'schema: ergogen/v1\nlayout: {objects: {key: {kind: key, envelopes: {keycap: {size: [18,18]}}}}}';
  const original = (await generate(source)).layout as LayoutReport;
  const move = vi.fn();
  const props = {
    selection: { section: 'objects' as const, id: 'key' },
    onSelect: vi.fn(),
    onMove: move,
    stale: false,
    source,
    side: 'top' as const,
    onSide: vi.fn(),
    rules: {},
  };
  const view = render(<StudioCanvas {...props} report={original} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Select key' }), {
    key: 'ArrowRight',
  });
  const candidate = vi.mocked(useLayoutAnalysis).mock.calls.at(-1)![0];
  let accepted: LayoutReport;
  await act(async () => {
    accepted = (await generate(candidate)).layout as LayoutReport;
  });
  const onMove = vi.fn(() => {
    view.rerender(
      <StudioCanvas {...props} source={candidate} stale report={original} />
    );
    return true;
  });
  vi.mocked(useLayoutAnalysis).mockReturnValue({
    pending: false,
    stale: false,
    error: '',
    result: { layout: accepted! },
  } as ReturnType<typeof useLayoutAnalysis>);
  view.rerender(<StudioCanvas {...props} onMove={onMove} report={original} />);
  expect(onMove).toHaveBeenCalledOnce();
  vi.mocked(useLayoutAnalysis).mockReturnValue({
    pending: false,
    stale: true,
    error: '',
  } as ReturnType<typeof useLayoutAnalysis>);
  view.rerender(
    <StudioCanvas {...props} source={candidate} stale report={original} />
  );
  expect(
    screen.getByRole('button', { name: 'Select key' }).querySelector('polygon')
  ).toHaveAttribute('points', '-4.25,9 13.75,9 13.75,-9 -4.25,-9');
});
it('selects a key without opening a popup', () => {
  Object.defineProperty(SVGSVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => null,
  });
  try {
    const select = vi.fn();
    render(
      <StudioCanvas
        report={report}
        selection={{ section: 'objects', id: '' }}
        onSelect={select}
        onMove={vi.fn()}
        stale={false}
        source=""
        side="top"
        onSide={vi.fn()}
        rules={{}}
      />
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Select key' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.pointerUp(
      screen.getByRole('group', { name: 'Interactive board layout' })
    );
    expect(select).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    Reflect.deleteProperty(SVGSVGElement.prototype, 'setPointerCapture');
    Reflect.deleteProperty(SVGSVGElement.prototype, 'getScreenCTM');
  }
});

it('preserves the chosen scope when selection changes outside the canvas', () => {
  const props = {
    report,
    onSelect: vi.fn(),
    onMove: vi.fn(),
    stale: false,
    source: '',
    side: 'top' as const,
    onSide: vi.fn(),
    rules: {},
  };
  const { rerender } = render(
    <StudioCanvas {...props} selection={{ section: 'columns', id: 'c1' }} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Select Matrices' }));
  rerender(
    <StudioCanvas {...props} selection={{ section: 'objects', id: 'key' }} />
  );
  expect(
    screen.getByRole('button', { name: 'Select Matrices' })
  ).toHaveAttribute('aria-pressed', 'true');
});
it('keeps the camera during inspector resizing before any pan or zoom', () => {
  const props = {
    selection: { section: 'objects' as const, id: 'key' },
    onSelect: vi.fn(),
    onMove: vi.fn(),
    stale: false,
    source: '',
    side: 'top' as const,
    onSide: vi.fn(),
    rules: {},
  };
  const { rerender } = render(<StudioCanvas {...props} report={report} />);
  const canvas = screen.getByRole('group', {
    name: 'Interactive board layout',
  });
  const before = canvas.getAttribute('viewBox');
  const enlarged = {
    ...report,
    objects: {
      key: {
        ...report.objects.key,
        envelopes: { keycap: { size: [100, 100] as [number, number] } },
      },
    },
  };
  rerender(<StudioCanvas {...props} report={enlarged} />);
  expect(canvas).toHaveAttribute('viewBox', before);
  fireEvent.click(screen.getByRole('button', { name: 'Fit layout' }));
  expect(canvas.getAttribute('viewBox')).not.toBe(before);
});
