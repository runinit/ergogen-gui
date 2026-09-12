import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import { StudioField } from './StudioStyles';
import {
  dimension,
  dimensionValue,
  formatDimension,
  type Dimension,
} from '../utils/designUnits';

const Controls = styled.div`
  display: flex;
  gap: ${theme.spacing.xs};
  min-width: 0;
  input {
    min-width: 0;
    width: 100%;
  }
  button {
    flex-shrink: 0;
    padding: ${theme.spacing.xs};
  }
`;
export default function DimensionField({
  label,
  value,
  units,
  onCommit,
  step,
  suffix = 'mm',
  disabled = false,
  name,
}: {
  name?: string;
  label: string;
  value: Dimension;
  units: Record<string, number>;
  onCommit: (value: Dimension) => void;
  step?: Dimension;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const hint = useId();
  useEffect(() => {
    setDraft(String(value));
    setError('');
  }, [value]);
  let actual: number | undefined;
  try {
    actual = dimension(dimensionValue(draft), units);
  } catch {
    /* Keep unfinished expressions editable. */
  }
  const commit = (text = draft) => {
    try {
      const next = dimensionValue(text);
      dimension(next, units);
      if (String(next) !== String(value)) {
        onCommit(next);
      }
      setError('');
    } catch {
      setError('Use a number or a valid parameter expression.');
    }
  };
  const increment = (direction: number) => {
    try {
      const change = dimension(step!, units) * direction;
      const before = dimensionValue(draft);
      const next =
        typeof before === 'number'
          ? String(formatDimension(before + change))
          : `(${before}) ${direction > 0 ? '+' : '-'} ${step}`;
      setDraft(next);
      commit(next);
    } catch {
      setError('Resolve the parameter before adjusting it.');
    }
  };
  return (
    <StudioField
      style={
        step !== undefined
          ? { gridTemplateColumns: 'minmax(0,1fr)' }
          : undefined
      }
    >
      <span>{label}</span>
      <div>
        <Controls>
          {step !== undefined && (
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              disabled={disabled}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => increment(-1)}
            >
              <Minus size={14} />
            </button>
          )}
          <input
            name={name}
            aria-label={label}
            aria-describedby={hint}
            aria-invalid={!!error}
            disabled={disabled}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setDraft(String(value));
                setError('');
              }
            }}
          />
          {step !== undefined && (
            <button
              type="button"
              aria-label={`Increase ${label}`}
              disabled={disabled}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => increment(1)}
            >
              <Plus size={14} />
            </button>
          )}
        </Controls>
        <small id={hint}>
          {error ||
            (actual === undefined
              ? 'Number or expression'
              : `= ${formatDimension(actual)} ${suffix}`)}
        </small>
      </div>
    </StudioField>
  );
}
