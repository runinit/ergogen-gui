import { fireEvent, render, screen } from '@testing-library/react';
import DesignView from './DesignView';
import type { GeometryJob } from '../hooks/useCasePreview';

const state = vi.hoisted(() => ({
  source: 'schema: ergogen/v1\nlayout: {}\ndesigns: {profiles: {board: {}}}',
  generateNow: vi.fn(),
  apply: vi.fn(),
}));
vi.mock('../context/ConfigContext', () => ({
  useConfigContext: () => ({
    configInput: state.source,
    getRealtimeConfigInput: () => state.source,
    results: null,
    resultsStale: true,
    generateNow: state.generateNow,
  }),
}));
vi.mock('../utils/designSource', async (original) => ({
  ...(await original<typeof import('../utils/designSource')>()),
  applyDesignEdit: state.apply,
}));

it('uses shared analysis for native sketch edits without starting a legacy build', () => {
  const job = {
    result: {
      designs: {
        features: {
          'profiles.board': {
            model: { paths: {} },
            contours: 1,
            source: 'board',
          },
        },
        assemblies: {},
        diagnostics: [],
        adjustments: [],
      },
    },
    stale: false,
    pending: false,
    error: '',
    diagnostics: [],
    generate: vi.fn(),
    cancel: vi.fn(),
  } satisfies GeometryJob;
  render(<DesignView session={{ analysis: job, preview: job }} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Design feature' }), {
    target: { value: 'profiles.board' },
  });
  expect(screen.queryByText(/Preview stale/)).not.toBeInTheDocument();
  fireEvent.blur(screen.getByRole('textbox', { name: 'Design clearance' }), {
    target: { value: '2' },
  });
  expect(state.apply).toHaveBeenCalledWith(
    state.source,
    expect.stringContaining('clearance:')
  );
  expect(state.generateNow).not.toHaveBeenCalled();
});
