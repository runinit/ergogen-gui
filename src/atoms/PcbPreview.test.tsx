import { vi } from 'vitest';
vi.mock('../utils/pcbViewer', () => ({
  loadPcbViewer: () => Promise.resolve(),
}));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PcbPreview from './PcbPreview';

it('reports preview errors without changing PCB bytes and recovers', async () => {
  const pcb = '(kicad_pcb (version 20260206))\n';
  const { rerender } = render(
    <PcbPreview pcb={pcb} previewKey="first" aria-label="PCB preview" />
  );
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  );
  const viewer = screen.getByLabelText('PCB preview');

  fireEvent(
    viewer,
    new CustomEvent('kicanvas:error', {
      detail: { message: 'Unsupported board' },
    })
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Download remains available'
  );
  expect(viewer.querySelector('kicanvas-source')?.textContent).toBe(pcb);

  rerender(
    <PcbPreview pcb={pcb + ' '} previewKey="second" aria-label="PCB preview" />
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent(
    screen.getByLabelText('PCB preview'),
    new CustomEvent('kicanvas:error')
  );
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent(
    screen.getByLabelText('PCB preview'),
    new CustomEvent('kicanvas:load')
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('keeps PCB source hidden before the custom element initializes', async () => {
  render(
    <PcbPreview
      pcb="(kicad_pcb)"
      previewKey="loading"
      aria-label="PCB preview"
    />
  );
  expect(
    screen.getByLabelText('PCB preview').querySelector('kicanvas-source')
  ).toHaveAttribute('hidden');
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  );
});
it('shows a recoverable startup error instead of raw source', async () => {
  const spy = vi
    .spyOn(await import('../utils/pcbViewer'), 'loadPcbViewer')
    .mockRejectedValueOnce(new Error('Network unavailable'));
  render(
    <PcbPreview
      pcb="(kicad_pcb)"
      previewKey="offline"
      aria-label="Offline PCB"
    />
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Viewer startup failed'
  );
  expect(
    screen.getByRole('button', { name: 'Retry viewer' })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry viewer' }));
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  spy.mockRestore();
});
