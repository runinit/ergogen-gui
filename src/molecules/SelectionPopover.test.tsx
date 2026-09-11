import { fireEvent, render, screen } from '@testing-library/react';
import SelectionPopover from './SelectionPopover';
it('opens explicitly and dismisses before interacting with the canvas', () => {
  render(
    <>
      <div aria-label="Canvas" />
      <SelectionPopover
        source={'schema: ergogen/v1\nlayout: {objects: {a: {kind: key}}}\n'}
        selection={{ section: 'objects', id: 'a' }}
        edit={() => {}}
      />
    </>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Quick edit a' }));
  expect(screen.getByRole('dialog', { name: 'Edit a' })).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByLabelText('Canvas'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('dismisses automatic controls with Escape while focus stays on the canvas', () => {
  render(
    <>
      <button aria-label="Canvas" />
      <SelectionPopover
        source={'schema: ergogen/v1\nlayout: {objects: {a: {kind: key}}}\n'}
        selection={{ section: 'objects', id: 'a' }}
        edit={() => {}}
        request={1}
      />
    </>
  );
  const canvas = screen.getByLabelText('Canvas');
  canvas.focus();
  fireEvent.keyDown(canvas, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(canvas).toHaveFocus();
});
it('focuses controls when explicitly requested from the keyboard', () => {
  render(
    <SelectionPopover
      source={'schema: ergogen/v1\nlayout: {objects: {a: {kind: key}}}\n'}
      selection={{ section: 'objects', id: 'a' }}
      edit={() => {}}
      request={1}
      intent="focus"
    />
  );
  expect(
    screen.getByRole('button', { name: 'Close quick edit' })
  ).toHaveFocus();
});
