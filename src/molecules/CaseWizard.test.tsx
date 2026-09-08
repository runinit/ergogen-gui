import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CaseWizard from './CaseWizard';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
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
  useCasePreview: () => ({ result: null, error: '', pending: true }),
}));
vi.mock('./AssemblyPreview', () => ({
  default: () => <div>Assembly preview</div>,
}));

beforeEach(() => {
  mocks.source = 'points:\n  zones:\n    keys: {}\n';
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
