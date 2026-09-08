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
  source: 'points:\n  zones:\n    keys: {}\n',
}));
vi.mock('../context/ConfigContext', () => ({
  useConfigContext: () => ({
    getRealtimeConfigInput: () => mocks.source,
    injectionInput: [],
    results: null,
    generateNow: mocks.generate,
  }),
}));
vi.mock('../hooks/useCasePreview', () => ({
  useCasePreview: (source: string) => {
    mocks.draft(source);
    return { result: mocks.result, error: mocks.error, pending: true };
  },
}));
vi.mock('./AssemblyPreview', () => ({
  default: (props: unknown) => {
    mocks.preview(props);
    return <div>Assembly preview</div>;
  },
}));

beforeEach(() => {
  mocks.source = 'points:\n  zones:\n    keys: {}\n';
  mocks.result = null;
  mocks.error = '';
  vi.clearAllMocks();
});

describe('Case wizard', () => {
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
  expect(mocks.preview.mock.lastCall?.[0].angle).toBe(6);
});

it('unchecks only the clicked layout point and permits selecting it again', () => {
  mocks.result = {
    points: { matrix_c1_r4: {}, matrix_c1_r3: {}, matrix_c1_r2: {} },
  };
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
  mocks.source += 'outlines:\n  board: [{what: rectangle, size: [60, 40]}]\n';
  mocks.error =
    'DesignError: designs.assemblies.case.profile: Expected one connected region; found 2';
  render(<CaseWizard onClose={mocks.close} />);
  expect(screen.getByRole('combobox', { name: 'Board profile' })).toHaveValue(
    'profiles.case_board'
  );
  expect(
    screen.queryByText('Showing the last valid geometry.')
  ).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Existing board outline' }),
    { target: { value: 'board' } }
  );
  expect(
    parse(mocks.draft.mock.lastCall![0]).designs.regions.case_keys.outline
  ).toBe('board');
  expect(screen.getByText(/Exclude helper points/)).toBeVisible();
});
