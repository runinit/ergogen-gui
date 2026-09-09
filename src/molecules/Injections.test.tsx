import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Injections from './Injections';
import footprints from '../../.generated/footprints.json';

const context = { injectionInput: [] as string[][] };
vi.mock('../context/ConfigContext', () => ({
  useConfigContext: () => context,
}));

it('exposes bundled BHK footprints and creates a separate editable override', () => {
  context.injectionInput = [['footprint', 'mine', 'custom source']];
  const edit = vi.fn();
  render(
    <Injections
      setInjectionToEdit={edit}
      deleteInjection={vi.fn()}
      injectionToEdit={{ key: 0, type: '', name: '', content: '' }}
    />
  );

  fireEvent.click(screen.getByText(/Bundled footprints/));
  fireEvent.click(
    screen.getByRole('button', { name: 'Customize bhkfp/cap_0603' })
  );

  expect(edit).toHaveBeenCalledWith({
    key: 1,
    type: 'footprint',
    name: 'bhkfp/cap_0603',
    content: footprints['bhkfp/cap_0603'],
  });
  expect(context.injectionInput).toEqual([
    ['footprint', 'mine', 'custom source'],
  ]);
});

it('does not offer a second override for an already customized footprint', () => {
  context.injectionInput = [['footprint', 'bhkfp/cap_0603', 'custom source']];
  render(
    <Injections
      setInjectionToEdit={vi.fn()}
      deleteInjection={vi.fn()}
      injectionToEdit={{ key: 0, type: '', name: '', content: '' }}
    />
  );

  expect(
    screen.queryByRole('button', { name: 'Customize bhkfp/cap_0603' })
  ).toBeNull();
  expect(screen.getByText(/Bundled footprints/)).toBeInTheDocument();
});
