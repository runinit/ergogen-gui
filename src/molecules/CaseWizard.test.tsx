import { parse } from 'yaml';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CaseWizard from './CaseWizard';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  preview: vi.fn(),
  draft: vi.fn(),
  error: '',
  result: null as Record<string, unknown> | null,
  close: vi.fn(),
  source:
    'schema: ergogen/v1\nlayout: {objects: {keys: {kind: key, envelopes: {pcb: {size: [18,18]}, plate: {size: [14,14]}}}}}\n',
}));
vi.mock('../context/ConfigContext', () => ({
  useConfigContext: () => ({
    getRealtimeConfigInput: () => mocks.source,
    injectionInput: [],
    results: null,
    generateNow: mocks.generate,
    adoptGenerated: vi.fn(),
    setError: vi.fn(),
  }),
}));
vi.mock('../hooks/useCasePreview', () => ({
  useCaseAnalysis: () => ({
    result: mocks.result,
    error: '',
    pending: false,
    stale: false,
  }),
  useCasePreview: (source: string) => {
    mocks.draft(source);
    return {
      result: mocks.result,
      error: mocks.error,
      pending: false,
      stale: true,
      diagnostics: [],
      generate: mocks.generate,
    };
  },
}));
vi.mock('./AssemblyPreview', () => ({
  default: (props: unknown) => {
    mocks.preview(props);
    return <div>Assembly preview</div>;
  },
}));

beforeEach(() => {
  mocks.source =
    'schema: ergogen/v1\nlayout: {objects: {keys: {kind: key, envelopes: {pcb: {size: [18,18]}, plate: {size: [14,14]}}}}}\n';
  mocks.result = null;
  mocks.error = '';
  vi.clearAllMocks();
});

describe('Case wizard', () => {
  it('can inspect a selected part before an assembly is generated', () => {
    render(<CaseWizard onClose={mocks.close} />);
    fireEvent.click(screen.getByRole('treeitem', { name: 'Case shell' }));
    fireEvent.click(screen.getByRole('button', { name: 'assembled' }));
    expect(
      screen.getByRole('combobox', { name: 'Inspect part' })
    ).toBeEnabled();
  });

  it('keeps edits in the draft and cancels without generating the saved design', () => {
    render(<CaseWizard onClose={mocks.close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enclosure' }));
    const wall = screen.getByLabelText('Wall thickness (mm)');
    fireEvent.change(wall, { target: { value: '4' } });
    fireEvent.blur(wall);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('blocks applying a draft until its geometry is current', () => {
    render(<CaseWizard onClose={mocks.close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('button', { name: 'Apply design' })).toBeDisabled();
  });
});

it('shows a recoverable error for invalid source instead of crashing', () => {
  mocks.source = 'points: [broken';
  render(<CaseWizard onClose={mocks.close} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/source|YAML/i);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

it('uses resolved dimensions for the preview when a field contains a formula', () => {
  mocks.result = {
    designs: {
      features: {},
      assemblies: {
        case: { parts: {}, suggestions: [], parameters: { typing_angle: 6 } },
      },
    },
  };
  render(<CaseWizard onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Enclosure' }));
  const angle = screen.getByLabelText('Typing angle (degrees)');
  fireEvent.change(angle, { target: { value: 'pitch / 3' } });
  fireEvent.blur(angle);
  fireEvent.click(screen.getByRole('button', { name: 'assembled' }));
  expect(mocks.preview.mock.lastCall?.[0].angle).toBe(6);
});

it('unchecks only the clicked layout point and permits selecting it again', () => {
  mocks.source =
    'schema: ergogen/v1\nlayout: {objects: {matrix_c1_r4: {kind: key}, matrix_c1_r3: {kind: key}, matrix_c1_r2: {kind: key}}}\n';
  render(<CaseWizard onClose={mocks.close} />);
  const group = screen.getByRole('group', { name: 'Included layout points' });
  const boxes = Array.from(group.querySelectorAll('input'));
  expect(boxes.every((box) => box.checked)).toBe(true);
  fireEvent.click(boxes[0]);
  expect(boxes[0]).not.toBeChecked();
  expect(boxes[1]).toBeChecked();
  expect(boxes[2]).toBeChecked();
  fireEvent.click(boxes[0]);
  expect(boxes.every((box) => box.checked)).toBe(true);
  expect(screen.getByRole('combobox', { name: 'Case' })).toHaveValue('case');
});

it('keeps layout controls usable before a disconnected case has a preview', () => {
  mocks.source +=
    'designs:\n  profiles:\n    board: {from: regions.board}\n  regions:\n    board: {shape: {size: [60,40]}}\n';
  mocks.error =
    'DesignError: designs.assemblies.case.profile: Expected one connected region; found 2';
  render(<CaseWizard onClose={mocks.close} />);
  expect(screen.getByRole('combobox', { name: 'Board profile' })).toHaveValue(
    'profiles.case_board'
  );
  expect(
    screen.queryByText('Showing the last valid geometry.')
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Board profile' }), {
    target: { value: 'profiles.board' },
  });
  expect(
    parse(mocks.draft.mock.lastCall![0]).designs.assemblies.case.profile
  ).toBe('profiles.board');
  expect(screen.getByText(/Choose keys for each cluster/)).toBeVisible();
});

it('provides named help for wizard and advanced controls across every step', () => {
  const { container } = render(<CaseWizard onClose={mocks.close} />);
  for (const step of [
    'Layout',
    'Manufacturing',
    'Mounting',
    'Enclosure',
    'Components',
    'Hardware',
    'Review',
  ]) {
    fireEvent.click(screen.getByRole('button', { name: step }));
    for (const control of Array.from(
      container.querySelectorAll<HTMLElement>('button,input,select,summary')
    )) {
      fireEvent.pointerOver(control);
      const description = control.getAttribute('aria-describedby');
      expect(
        description,
        `${step}: ${control.getAttribute('aria-label') || control.textContent}`
      ).toBeTruthy();
      expect(
        document.getElementById(description!)?.textContent?.length
      ).toBeGreaterThan(20);
      fireEvent.pointerOut(control);
    }
  }
});

it('keeps repeated component findings out of Layout and groups them in Review', () => {
  mocks.result = {
    designs: {
      assemblies: {},
      analysis: {
        case: {
          parameters: {},
          placements: [],
          suggestions: [],
          edges: [],
          findings: ['D1', 'D2'].map((id) => ({
            feature: `designs.assemblies.case.board.components.${id}`,
            code: 'component-height',
            severity: 'warning',
            message: `${id}: missing body size or height.`,
          })),
        },
      },
    },
  };
  render(<CaseWizard onClose={mocks.close} />);
  expect(screen.queryByText(/D1: missing/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(screen.getAllByText(/component-height/)).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'Set up components' })
  ).toBeEnabled();
});

it('offers a mount count beneath the mounting system', () => {
  render(<CaseWizard onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mounting' }));
  expect(screen.getByLabelText('Mount / gasket count')).toBeInTheDocument();
});

it('clears the requested count to restore spacing-based placement', () => {
  render(<CaseWizard onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mounting' }));
  let field = screen.getByLabelText('Mount / gasket count');
  fireEvent.change(field, { target: { value: '4' } });
  fireEvent.blur(field);
  expect(
    parse(mocks.draft.mock.lastCall![0]).designs.assemblies.case.mount_count
  ).toBe(4);
  field = screen.getByLabelText('Mount / gasket count');
  fireEvent.change(field, { target: { value: '' } });
  fireEvent.blur(field);
  expect(
    parse(mocks.draft.mock.lastCall![0]).designs.assemblies.case.mount_count
  ).toBeUndefined();
});

it('opens manufacturing from an affected finding', () => {
  mocks.result = {
    designs: {
      assemblies: {},
      analysis: {
        case: {
          parameters: {},
          placements: [],
          suggestions: [],
          edges: [],
          findings: [
            {
              feature: 'designs.assemblies.case.manufacturing.bottom.tool',
              code: 'tool',
              severity: 'error',
              message: 'Tool cannot reach the cavity',
            },
          ],
        },
      },
    },
  };
  render(<CaseWizard onClose={mocks.close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  fireEvent.click(screen.getByText('Affected features (1)'));
  fireEvent.click(screen.getByRole('button', { name: 'tool' }));
  expect(screen.getByRole('heading', { name: 'Manufacturing' })).toBeVisible();
});

it('waits for automatic mounting edits before enabling generation', () => {
  render(<CaseWizard onClose={mocks.close} />);
  fireEvent.change(screen.getByLabelText('Mounting system'), {
    target: { value: 'gasket' },
  });
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
});
