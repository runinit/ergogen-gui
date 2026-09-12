import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import type { ResizeProposal } from '../utils/resizeReview';
const Dialog = styled.dialog`
  color: ${theme.colors.text};
  background: ${theme.colors.backgroundLight};
  border: 1px solid ${theme.colors.border};
  padding: ${theme.spacing.lg};
  max-width: min(560px, 90vw);
  max-height: 85dvh;
  overflow: auto;
`;
export default function ResizeReviewDialog({
  proposal,
  onCancel,
  onApply,
}: {
  proposal: ResizeProposal;
  onCancel: () => void;
  onApply: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    if (element?.showModal) {
      element.showModal();
    } else {
      element?.setAttribute('open', '');
    }
    element?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <Dialog
      ref={dialog}
      aria-label="Review matrix resize"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2>Remove keys and resize?</h2>
      <p>
        This resize removes edited keys and their owned components. Undo
        restores the entire change.
      </p>
      <ul>
        {proposal.keys.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      {proposal.blockers.map((message) => (
        <p role="alert" key={message}>
          {message}
        </p>
      ))}
      <button onClick={onCancel}>Cancel</button>{' '}
      <button disabled={proposal.blockers.length > 0} onClick={onApply}>
        Remove keys and resize
      </button>
    </Dialog>
  );
}
