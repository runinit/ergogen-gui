import { fireEvent, render, screen } from '@testing-library/react';
import type { LayoutReport } from 'ergogen/src/native';
import StudioCanvas from './StudioCanvas';

vi.mock('../hooks/useCasePreview', () => ({
  useLayoutAnalysis: () => ({ pending: false, stale: true, error: '' }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
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
