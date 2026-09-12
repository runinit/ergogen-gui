import styled from 'styled-components';
import { theme } from '../theme/theme';
import { UNIT_STEPS } from '../utils/designUnits';
import type { SnapOptions } from '../utils/layoutSnapping';

const Bar = styled.div`
  position: absolute;
  top: ${theme.spacing.md};
  left: calc(${theme.studio.touchSize} + ${theme.spacing.lg});
  right: ${theme.spacing.md};
  width: fit-content;
  max-width: calc(
    100% - ${theme.studio.touchSize} - ${theme.spacing.lg} - ${theme.spacing.md}
  );
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  border-radius: ${theme.studio.toolRadius};
  background: ${theme.colors.backgroundLight};
  box-shadow: ${theme.studio.toolShadow};
  button {
    padding: ${theme.spacing.sm};
    border-radius: ${theme.studio.pillRadius};
  }
  details {
    position: relative;
  }
  details > div {
    position: absolute;
    right: 0;
    top: 100%;
    width: ${theme.studio.toolOptionsWidth};
    max-width: 70vw;
    padding: ${theme.spacing.md};
    background: ${theme.colors.backgroundLight};
    box-shadow: ${theme.studio.toolShadow};
    border-radius: ${theme.studio.toolRadius};
  }
  input {
    width: 100%;
  }
  input[type='checkbox'] {
    width: auto;
    margin-right: ${theme.spacing.sm};
  }
  label {
    display: block;
    margin-bottom: ${theme.spacing.sm};
  }
`;
export default function SnapControls({
  options,
  onChange,
  enabled,
  units,
}: {
  options: SnapOptions;
  onChange: (value: SnapOptions) => void;
  enabled: boolean;
  units: Record<string, number>;
}) {
  return (
    <Bar role="toolbar" aria-label="Snap increments">
      {UNIT_STEPS.map((step, index) => (
        <button
          key={step}
          aria-label={`Snap increment ${step}u`}
          aria-pressed={!options.millimetres && options.step === step}
          disabled={!enabled}
          onClick={() => onChange({ ...options, step, millimetres: 0 })}
        >
          {['1', '½', '¼', '⅛'][index]}
          {units.u === units.v ? 'u' : 'u/v'}
        </button>
      ))}
      <details>
        <summary>Snap options</summary>
        <div>
          {(['grid', 'centers', 'edges'] as const).map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={options[kind]}
                onChange={(event) =>
                  onChange({ ...options, [kind]: event.target.checked })
                }
              />
              {kind === 'centers'
                ? 'Center guides'
                : kind === 'grid'
                  ? 'Increment grid'
                  : 'Edge guides'}
            </label>
          ))}
          <label>
            Custom increment · mm
            <input
              aria-label="Custom snap increment"
              type="number"
              min="0"
              step="0.1"
              value={options.millimetres || ''}
              placeholder="Use unit increment"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= 0) {
                  onChange({ ...options, millimetres: value });
                }
              }}
            />
          </label>
          <small>
            1u = {units.u} mm · 1v = {units.v} mm. Alt bypasses snapping.
          </small>
        </div>
      </details>
    </Bar>
  );
}
