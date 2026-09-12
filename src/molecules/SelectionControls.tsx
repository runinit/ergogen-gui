import { useState } from 'react';
import DimensionField from './DimensionField';
import {
  dimension,
  dimensionValue,
  pitchUnits,
  ensurePitchUnits,
} from '../utils/designUnits';
import { targets } from '../utils/studioTargets';
import type { LayoutReport } from 'ergogen/src/native';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import { StudioField } from './StudioStyles';
import type { StudioSelection } from './StudioCanvas';
import { KEY_SIZES } from '../utils/keySizes';
import {
  selectedKeys,
  sizeSelection,
  adjustSelection,
} from '../utils/studioSelection';
import { getValue, readStudio } from '../utils/studioSource';
import {
  keyElectronics,
  keyOptions,
  hasElectronics,
  electronicsAt,
} from '../utils/keyOptions';
import type { KeyAlignment } from '../utils/keyResize';
import { setLayout } from '../utils/layoutSource';

const RelativeFields = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${theme.spacing.sm};
  margin: ${theme.spacing.sm} 0;
  label {
    grid-template-columns: minmax(0, 1fr);
    margin: 0;
  }
  input {
    width: 100%;
  }
`;
type Props = {
  source: string;
  selection: StudioSelection;
  report?: LayoutReport;
  edit: (change: (source: string) => string) => void;
};
export default function SelectionControls({
  source,
  selection,
  report,
  edit,
}: Props) {
  const [adjustment, setAdjustment] = useState(0);
  const [adjustError, setAdjustError] = useState('');
  const units = pitchUnits(source);
  const keys = selectedKeys(source, selection),
    data = readStudio(source);
  const item = data.layout.objects?.[keys[0]];
  const cluster =
    selection.section === 'clusters'
      ? selection.id
      : selection.cluster || item?.cluster;
  const locked =
    targets(selection).some((target) =>
      target.section === 'objects'
        ? report?.objects[target.id]?.locked ||
          data.layout.objects?.[target.id]?.locked
        : data.layout.clusters?.[target.cluster || target.id]?.locked
    ) ||
    !!data.layout.clusters?.[cluster || '']?.locked ||
    keys.some((id) => data.layout.objects?.[id]?.locked);
  const size = item?.envelopes?.keycap?.size ||
    data.parts?.[item?.part || '']?.envelopes?.keycap?.size || [18, 18];
  const alignment = (item?.properties?.key_alignment as KeyAlignment) || {
    x: 'auto',
    y: 'top',
  };
  const mixedSize = keys.some((id) => {
    const key = data.layout.objects![id];
    const other = key.envelopes?.keycap?.size ||
      data.parts?.[key.part || '']?.envelopes?.keycap?.size || [18, 18];
    return other.some((value, index) => value !== size[index]);
  });
  return (
    <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>Selection adjustments</legend>
      {selection.section === 'clusters' &&
        data.layout.clusters?.[selection.id]?.arrangement?.type === 'columns' &&
        ['Column', 'Row'].map((label, index) => {
          const pitch = data.layout.clusters![selection.id].arrangement!
            .pitch || [19, 19];
          return (
            <DimensionField
              key={`${selection.id}-${label}`}
              label={`Selection ${label.toLowerCase()} spacing`}
              value={pitch[index]}
              units={units}
              onCommit={(value) =>
                edit((before) => {
                  const at = [
                    ...((getValue(before, [
                      'layout',
                      'clusters',
                      selection.id,
                      'arrangement',
                      'pitch',
                    ]) as (number | string)[]) || ['u', 'v']),
                  ];
                  at[index] = value;
                  return setLayout(
                    ensurePitchUnits(before),
                    'clusters',
                    selection.id,
                    ['arrangement', 'pitch'],
                    at
                  );
                })
              }
            />
          );
        })}
      {!!keys.length && (
        <>
          <StudioField>
            <span>Key size</span>
            <select
              aria-label="Selection key size"
              value={
                (!mixedSize &&
                  KEY_SIZES.find((p) => p.size.every((v, i) => v === size[i]))
                    ?.id) ||
                ''
              }
              onChange={(event) => {
                const preset = KEY_SIZES.find(
                  (p) => p.id === event.target.value
                );
                if (preset) {
                  edit((before) =>
                    sizeSelection(
                      before,
                      selection,
                      preset.size,
                      undefined,
                      report
                    )
                  );
                }
              }}
            >
              <option value="">Custom / mixed</option>
              {KEY_SIZES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </StudioField>
          <StudioField>
            <span>Align X</span>
            <select
              aria-label="Horizontal alignment"
              value={alignment.x}
              onChange={(event) =>
                edit((before) =>
                  sizeSelection(
                    before,
                    selection,
                    undefined,
                    { x: event.target.value as KeyAlignment['x'] },
                    report
                  )
                )
              }
            >
              <option value="auto">Auto (make room)</option>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
          </StudioField>
          <StudioField>
            <span>Align Y</span>
            <select
              aria-label="Vertical alignment"
              value={alignment.y}
              onChange={(event) =>
                edit((before) =>
                  sizeSelection(
                    before,
                    selection,
                    undefined,
                    { y: event.target.value as KeyAlignment['y'] },
                    report
                  )
                )
              }
            >
              <option value="top">Top</option>
              <option value="center">Centre</option>
              <option value="bottom">Bottom</option>
            </select>
          </StudioField>
        </>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget,
            values = new FormData(form);
          try {
            const value = (name: string) =>
              dimension(dimensionValue(String(values.get(name) || '0')), units);
            edit((before) =>
              adjustSelection(
                ensurePitchUnits(before),
                selection,
                [value('x'), value('y'), 0],
                value('rotation'),
                value('stagger')
              )
            );
            setAdjustment((count) => count + 1);
            setAdjustError('');
          } catch (reason) {
            setAdjustError(String(reason));
          }
        }}
      >
        <small>Relative to current placement, in the parent’s axes.</small>
        <RelativeFields>
          {[
            'x',
            'y',
            'rotation',
            ...(selection.section === 'columns' ? ['stagger'] : []),
          ].map((name) => (
            <DimensionField
              key={`${name}-${adjustment}`}
              name={name}
              label={`Relative ${name}`}
              value={0}
              units={units}
              suffix={name === 'rotation' ? '°' : 'mm'}
              onCommit={() => {}}
            />
          ))}
        </RelativeFields>
        <button type="submit">Apply relative adjustment</button>
        {adjustError && <p role="alert">{adjustError}</p>}
      </form>
      {!!keys.length && (
        <details>
          <summary>Per-key electronics</summary>
          {(['diode', 'led'] as const).map((kind) => (
            <div key={kind}>
              <StudioField key={kind}>
                <span>
                  {kind === 'diode' ? 'Switch diode' : 'SK6812 MINI-E LED'}
                </span>
                <input
                  type="checkbox"
                  aria-label={`Selection ${kind}`}
                  checked={keys.every((id) => hasElectronics(source, id, kind))}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    edit((before) =>
                      keys.reduce((next, id) => {
                        const options = keyOptions(
                          next,
                          readStudio(next).layout.objects?.[id]?.cluster
                        );
                        const diode = hasElectronics(next, id, 'diode');
                        const led = hasElectronics(next, id, 'led');
                        return keyElectronics(next, id, {
                          ...options,
                          diodeAt: electronicsAt(next, id, 'diode'),
                          ledAt: electronicsAt(next, id, 'led'),
                          diode,
                          led,
                          [kind]: enabled,
                        });
                      }, before)
                    );
                  }}
                />
              </StudioField>
              {keys.some((id) =>
                getValue(source, [
                  'layout',
                  'objects',
                  id,
                  'footprints',
                  `studio_${kind}`,
                ])
              ) &&
                ['X', 'Y'].map((axis, index) => {
                  const value = ((getValue(source, [
                    'layout',
                    'objects',
                    keys[0],
                    'footprints',
                    `studio_${kind}`,
                    'placement',
                    'at',
                  ]) as number[]) || keyOptions(source, cluster)[`${kind}At`])[
                    index
                  ];
                  return (
                    <StudioField key={`${axis}-${value}`}>
                      <span>
                        {kind} offset {axis}
                      </span>
                      <input
                        aria-label={`Selection ${kind} offset ${axis}`}
                        type="number"
                        step="any"
                        defaultValue={value}
                        onBlur={(event) => {
                          const nextValue = Number(event.target.value);
                          if (!Number.isFinite(nextValue)) {
                            return;
                          }
                          edit((before) =>
                            keys.reduce((next, id) => {
                              const path = [
                                'footprints',
                                `studio_${kind}`,
                                'placement',
                                'at',
                              ];
                              const old = getValue(next, [
                                'layout',
                                'objects',
                                id,
                                ...path,
                              ]) as number[];
                              if (!old) {
                                return next;
                              }
                              const at = [...old];
                              at[index] = nextValue;
                              return setLayout(next, 'objects', id, path, at);
                            }, before)
                          );
                        }}
                      />
                    </StudioField>
                  );
                })}
            </div>
          ))}
          <small>
            Footprints follow each key. LEDs expose separate DIN/DOUT nets for
            PCB connections.
          </small>
        </details>
      )}
    </fieldset>
  );
}
