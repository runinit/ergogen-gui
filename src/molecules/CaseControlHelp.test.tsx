import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect } from 'vitest';
import CaseControlHelp from './CaseControlHelp';
it('dismisses help when manipulating the plan', () => {
  const root = createRef<HTMLDivElement>();
  render(
    <div ref={root}>
      <button>Inspector</button>
      <svg aria-label="Plan" />
      <CaseControlHelp root={root} />
    </div>
  );
  fireEvent.focusIn(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toBeVisible();
  fireEvent.pointerDown(screen.getByLabelText('Plan'));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'touch' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
