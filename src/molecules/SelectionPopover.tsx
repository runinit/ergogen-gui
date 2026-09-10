import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { LayoutReport } from 'ergogen/src/native';
import { theme } from '../theme/theme';
import type { StudioSelection } from './StudioCanvas';
import SelectionControls from './SelectionControls';
const Panel = styled.div`
  position: absolute;
  inset-inline-end: ${theme.spacing.md};
  top: ${theme.spacing.md};
  z-index: ${theme.studio.popoverLayer};
  max-height: calc(100% - ${theme.spacing.lg});
  width: min(${theme.studio.popoverWidth}, calc(100% - ${theme.spacing.lg}));
  box-sizing: border-box;
  overflow: auto;
  padding: ${theme.spacing.md};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.cad.fieldRadius};
  background: ${theme.colors.background};
  > button {
    position: sticky;
    top: 0;
    z-index: 1;
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    position: fixed;
    top: auto;
    bottom: ${theme.spacing.md};
    max-height: ${theme.studio.popoverHeight};
  }
`;
export default function SelectionPopover({
  source,
  selection,
  report,
  edit,
  request = 0,
}: {
  source: string;
  selection: StudioSelection;
  report?: LayoutReport;
  edit: (change: (source: string) => string) => void;
  request?: number;
}) {
  const [open, setOpen] = useState(false),
    panel = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (request) {
      setOpen(true);
    }
  }, [request]);
  useEffect(() => {
    if (open) {
      panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  if (
    !selection.id ||
    !['objects', 'columns', 'clusters'].includes(selection.section)
  ) {
    return null;
  }
  return (
    <>
      <button ref={trigger} aria-expanded={open} onClick={() => setOpen(!open)}>
        Quick edit {selection.id}
      </button>
      {open && (
        <Panel
          ref={panel}
          role="dialog"
          aria-label={`Edit ${selection.id}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <button onClick={close}>Close quick edit</button>
          <SelectionControls
            source={source}
            selection={selection}
            report={report}
            edit={edit}
          />
        </Panel>
      )}
    </>
  );
}
