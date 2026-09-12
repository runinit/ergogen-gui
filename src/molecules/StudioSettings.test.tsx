import { fireEvent, render, screen } from '@testing-library/react';
import StudioSettings from './StudioSettings';
import type { Injection } from '../atoms/InjectionRow';

const context = vi.hoisted(() => ({
  injectionInput: [['template', 'custom', 'module.exports = {}']],
  setInjectionInput: vi.fn(),
  sendUsageMetrics: false,
  setSendUsageMetrics: vi.fn(),
}));
vi.mock('../context/ConfigContext', () => ({
  useConfigContext: () => context,
}));
vi.mock('./Injections', () => ({
  default: ({
    setInjectionToEdit,
  }: {
    setInjectionToEdit: (value: Injection) => void;
  }) => (
    <button
      onClick={() =>
        setInjectionToEdit({
          key: 0,
          type: 'template',
          name: 'custom',
          content: 'module.exports = {}',
        })
      }
    >
      Edit template
    </button>
  ),
}));
vi.mock('./InjectionEditor', () => ({
  default: () => <div>Library editor</div>,
}));

it('opens an existing library without recording an edit', () => {
  render(<StudioSettings onClose={vi.fn()} onLibrary={vi.fn()} />);
  expect(screen.queryByText('Library editor')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Advanced libraries'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit template' }));
  expect(screen.getByText('Library editor')).toBeVisible();
  expect(context.setInjectionInput).not.toHaveBeenCalled();

  fireEvent.change(screen.getByRole('textbox', { name: 'Library name' }), {
    target: { value: 'renamed' },
  });
  expect(context.setInjectionInput).toHaveBeenCalledOnce();
});
