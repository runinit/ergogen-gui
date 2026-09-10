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
