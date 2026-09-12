import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  MousePointer2,
  Columns3,
  Grid2X2,
  Trash2,
  Hand,
  Maximize,
  Minus,
  Plus,
  ListFilter,
  Magnet,
} from 'lucide-react';
import styled from 'styled-components';
import { theme, studioDockInset } from '../theme/theme';
import { StudioField } from './StudioStyles';

const Dock = styled.div`
  position: absolute;
  z-index: ${theme.studio.panelLayer};
  display: flex;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  border: 0;
  border-radius: ${theme.studio.toolRadius};
  background: ${theme.colors.backgroundLight};
  box-shadow: ${theme.studio.toolShadow};
  button {
    padding: ${theme.spacing.sm};
    min-width: ${theme.studio.touchSize};
    border: 0;
    border-radius: ${theme.studio.toolRadius};
    background: transparent;
  }
  button:hover {
    background: ${theme.colors.buttonHover};
  }
  button[aria-pressed='true'],
  button[aria-expanded='true'] {
    background: ${theme.studio.selected};
    color: ${theme.colors.accent};
  }
`;
const Rail = styled(Dock)`
  top: ${theme.spacing.md};
  left: ${theme.spacing.md};
  flex-direction: column;
`;
const InspectorDock = styled(Dock)`
  top: ${theme.spacing.md};
  left: ${studioDockInset};
`;
const Zoom = styled(Dock)`
  z-index: ${theme.studio.panelLayer - 1};
  bottom: ${theme.spacing.md};
  right: ${theme.spacing.md};
  align-items: center;
  small {
    min-width: 3em;
    text-align: center;
  }
`;
const Options = styled.div`
  position: absolute;
  left: calc(100% + ${theme.spacing.sm});
  top: 0;
  width: min(${theme.studio.toolOptionsWidth}, calc(100vw - 7rem));
  padding: ${theme.spacing.md};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.cad.fieldRadius};
  background: ${theme.colors.background};
  box-shadow: ${theme.studio.toolShadow};
  box-sizing: border-box;
  button {
    border-radius: ${theme.cad.fieldRadius};
  }
`;
export default function CanvasTools({
  tool,
  setTool,
  scope,
  setScope,
  side,
  setSide,
  reset,
  zoom,
  scale,
  snapping,
  setSnapping,
  gap,
  setGap,
  relative,
  setRelative,
  relativeReason,
  inspector,
  onDelete,
}: {
  tool: string;
  setTool: (value: string) => void;
  scope: string;
  setScope: (value: string) => void;
  side: 'top' | 'side';
  setSide: (value: 'top' | 'side') => void;
  reset: () => void;
  zoom: (direction: 'in' | 'out') => void;
  scale: number;
  snapping: boolean;
  setSnapping: (value: boolean) => void;
  gap: number;
  setGap: (value: number) => void;
  relative: boolean;
  setRelative: (value: boolean) => void;
  relativeReason: string;
  inspector?: ReactNode;
  onDelete?: () => void;
}) {
  const [options, setOptions] = useState(false);
  const optionsPanel = useRef<HTMLDivElement>(null);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!options) {
      return;
    }
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !optionsPanel.current?.contains(event.target) &&
        !optionsTrigger.current?.contains(event.target)
      ) {
        setOptions(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [options]);
  return (
    <>
      <Rail
        role="toolbar"
        aria-label="Canvas tools"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOptions(false);
          }
        }}
      >
        {[
          [MousePointer2, 'keys', 'Objects'],
          [Columns3, 'columns', 'Columns'],
          [Grid2X2, 'clusters', 'Matrices'],
        ].map(([Icon, id, label]) => {
          const Glyph = Icon as typeof Hand;
          return (
            <button
              key={String(id)}
              aria-label={`Select ${label}`}
              title={`Select ${label}`}
              aria-pressed={tool === 'select' && scope === id}
              onClick={() => {
                setScope(String(id));
                setTool('select');
              }}
            >
              <Glyph size={18} />
            </button>
          );
        })}
        <button
          aria-label="Pan"
          title="Pan"
          aria-pressed={tool === 'pan'}
          onClick={() => setTool('pan')}
        >
          <Hand size={18} />
        </button>
        <button
          ref={optionsTrigger}
          aria-label="Canvas options"
          title="Snapping options"
          aria-expanded={options}
          onClick={() => setOptions(!options)}
        >
          <ListFilter size={18} />
        </button>
        <button
          aria-label="Snap to edges"
          title="Snap to edges · hold Alt to bypass"
          aria-pressed={snapping}
          onClick={() => setSnapping(!snapping)}
        >
          <Magnet size={18} />
        </button>
        {onDelete && (
          <button
            aria-label="Delete selection"
            title="Delete selection · Delete"
            onClick={onDelete}
          >
            <Trash2 size={18} />
          </button>
        )}
        {options && (
          <Options ref={optionsPanel} role="group" aria-label="Canvas options">
            <StudioField>
              <span>Component gap · mm</span>
              <input
                aria-label="Snap edge gap"
                type="number"
                step="0.5"
                min="0"
                value={gap}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value >= 0) {
                    setGap(value);
                  }
                }}
              />
            </StudioField>
            <StudioField>
              <span>Keep relative</span>
              <input
                type="checkbox"
                aria-label="Keep relative placement"
                checked={relative && !relativeReason}
                disabled={!!relativeReason}
                onChange={(e) => setRelative(e.target.checked)}
              />
            </StudioField>
            <small>
              {relativeReason ||
                'A snapped drop saves its target and offset. Moving the target carries this component with it.'}
            </small>
            <p>
              <small>
                Keys use their layout spacing.
                <br />
                Ctrl/Cmd toggles · Shift range
                <br />
                Alt bypasses snapping · arrows nudge
              </small>
            </p>
            <button onClick={() => setOptions(false)}>Close options</button>
          </Options>
        )}
      </Rail>
      {inspector && <InspectorDock>{inspector}</InspectorDock>}
      <Zoom role="toolbar" aria-label="View controls">
        <button
          onClick={() => {
            setSide(side === 'top' ? 'side' : 'top');
            reset();
          }}
          title="Change viewing plane"
        >
          {side === 'top' ? 'Side' : '2D'}
        </button>
        <button aria-label="Fit layout" title="Fit layout" onClick={reset}>
          <Maximize size={16} />
        </button>
        <button
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoom('out')}
        >
          <Minus size={16} />
        </button>
        <small>{scale}%</small>
        <button aria-label="Zoom in" title="Zoom in" onClick={() => zoom('in')}>
          <Plus size={16} />
        </button>
      </Zoom>
    </>
  );
}
