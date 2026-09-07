import { fireEvent, render, screen } from '@testing-library/react';
import PcbPreview from './PcbPreview';

it('reports preview errors without changing PCB bytes and recovers', () => {
  const pcb = '(kicad_pcb (version 20260206))\n';
  const { rerender } = render(
    <PcbPreview pcb={pcb} previewKey="first" aria-label="PCB preview" />
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
