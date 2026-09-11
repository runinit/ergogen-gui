import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { targets } from '../utils/studioTargets';
import styled, { keyframes } from 'styled-components';
import type { LayoutReport } from 'ergogen/src/native';
import { theme } from '../theme/theme';
import type { StudioSelection } from './StudioCanvas';
import SelectionControls from './SelectionControls';
const slideIn = keyframes`from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); }`;
const Panel = styled.div`
  animation: ${slideIn} 140ms ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  position: absolute;
  left: var(--quick-x, calc(100% + ${theme.spacing.sm}));
  top: 0;
  z-index: ${theme.studio.popoverLayer};
  max-height: calc(100dvh - ${theme.studio.popoverClearance});
  width: min(${theme.studio.popoverWidth}, calc(100vw - 7rem));
  box-shadow: ${theme.studio.toolShadow};
  box-sizing: border-box;
  overflow: auto;
  padding: ${theme.spacing.md};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.cad.fieldRadius};
  background: ${theme.colors.background};
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing.sm};
  }
  header h3 {
    margin: 0;
  }
  fieldset > legend {
    display: none;
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    position: fixed;
    left: ${theme.spacing.md};
    width: calc(100vw - 2 * ${theme.spacing.md});
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
  intent = 'select',
}: {
  source: string;
  selection: StudioSelection;
  report?: LayoutReport;
  edit: (change: (source: string) => string) => void;
  request?: number;
  intent?: 'select' | 'focus';
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
    if (open && intent === 'focus') {
      panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [open, request, intent]);
  useLayoutEffect(() => {
    const node = panel.current;
    if (!open || !node) {
      return;
    }
    node.style.removeProperty('--quick-x');
    const bounds = node.getBoundingClientRect();
    const main = node.closest('main');
    const selected = Array.from(
      main?.querySelectorAll('[data-object][aria-pressed="true"]') || []
    ).map((item) => item.getBoundingClientRect());
    const overlaps = (left: number) =>
      selected.some(
        (item) =>
          item.right > left &&
          item.left < left + bounds.width &&
          item.bottom > bounds.top &&
          item.top < bounds.bottom
      );
    const right =
      (main?.getBoundingClientRect().right || bounds.right) -
      bounds.width -
      Number.parseFloat(getComputedStyle(node).paddingRight);
    if (overlaps(bounds.left) && !overlaps(right) && node.offsetParent) {
      node.style.setProperty(
        '--quick-x',
        `${right - node.offsetParent.getBoundingClientRect().left}px`
      );
    }
  }, [open, selection]);
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
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
    };
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
  const label =
    targets(selection).length > 1
      ? `${targets(selection).length} selected`
      : selection.id;
  return (
    <>
      <button
        ref={trigger}
        aria-label={`Quick edit ${label}`}
        title={`Quick edit ${label}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            requestAnimationFrame(() =>
              panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
            );
          }
        }}
      >
        <SlidersHorizontal size={18} />
      </button>
      {open && (
        <Panel
          ref={panel}
          role="dialog"
          aria-label={`Edit ${label}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header>
            <h3>
              {targets(selection).length > 1
                ? label
                : `${selection.section === 'columns' ? 'Column' : selection.section === 'clusters' ? 'Matrix' : 'Object'} · ${label}`}
            </h3>
            <button
              aria-label="Close quick edit"
              title="Close quick edit"
              onClick={close}
            >
              <X size={16} />
            </button>
          </header>
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
