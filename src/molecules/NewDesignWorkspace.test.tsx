import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import NewDesignWorkspace from './NewDesignWorkspace';
import { parse } from 'yaml';
vi.mock('../utils/footprintService', () => ({
  prepareFootprint: async () => ({
    info: {
      pads: [],
      graphics: [],
      nets: [],
      models: [],
      targets: [],
      diagnostics: [],
    },
  }),
}));
vi.mock('../utils/componentModels', () => ({
  setupModels: () => [],
  loadComponentModel: vi.fn(),
}));
vi.mock('./FootprintCanvas', () => ({ default: () => <div>3D preview</div> }));
beforeEach(() => localStorage.clear());
it('creates a draft with edited matrix and diode placement', async () => {
  const create = vi.fn();
  render(<NewDesignWorkspace onCreate={create} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Columns' }), {
    target: { value: '6' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Key assembly' }));
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Selected component' }),
    { target: { value: 'diode' } }
  );
  fireEvent.change(screen.getByRole('spinbutton', { name: 'X offset' }), {
    target: { value: '3' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  const source = parse(create.mock.calls[0][0]);
  expect(source.layout.clusters.fingers.arrangement.columns).toHaveLength(6);
  expect(source.layout.objects.fingers_c1_r1_diode.placement.at).toEqual([
    3, -5, 0,
  ]);
});
it('cancels without creating a project and keeps sections freely accessible', () => {
  const create = vi.fn(),
    cancel = vi.fn();
  render(<NewDesignWorkspace onCreate={create} onCancel={cancel} />);
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Design setup' })).getByRole(
      'button',
      { name: 'Review' }
    )
  );
  expect(
    screen.getByText('Choose a controller before PCB review.')
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(create).not.toHaveBeenCalled();
});
it('moves a component with arrow keys without moving the key origin', async () => {
  const create = vi.fn();
  render(<NewDesignWorkspace onCreate={create} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Key assembly' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Move diode' }), {
    key: 'ArrowRight',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  expect(
    parse(create.mock.calls[0][0]).layout.objects.fingers_c1_r1_diode.placement
      .at
  ).toEqual([0.25, -5, 0]);
});
