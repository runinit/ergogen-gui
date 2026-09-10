import type { LayoutReport } from 'ergogen/src/native';
import { StudioActions, StudioField } from './StudioStyles';
import type { StudioSelection } from './StudioCanvas';
import { KEY_SIZES } from '../utils/keySizes';
import {
  selectedKeys,
  sizeSelection,
  adjustSelection,
} from '../utils/studioSelection';
import { getValue, readStudio } from '../utils/studioSource';
import { keyElectronics, keyOptions } from '../utils/keyOptions';
import type { KeyAlignment } from '../utils/keyResize';
import { setLayout } from '../utils/layoutSource';

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
  const keys = selectedKeys(source, selection),
    data = readStudio(source);
  const item = data.layout.objects?.[keys[0]];
  const cluster =
    selection.section === 'clusters'
      ? selection.id
      : selection.cluster || item?.cluster;
  const locked =
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
            <StudioField key={`${label}-${pitch[index]}`}>
              <span>{label} spacing</span>
              <input
                aria-label={`Selection ${label.toLowerCase()} spacing`}
                defaultValue={pitch[index]}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (!value) {
                    return;
                  }
                  edit((before) => {
                    const at = [
                      ...((getValue(before, [
                        'layout',
                        'clusters',
                        selection.id,
                        'arrangement',
                        'pitch',
                      ]) as (number | string)[]) || [19, 19]),
                    ];
                    at[index] = Number.isFinite(Number(value))
                      ? Number(value)
                      : value;
                    return setLayout(
                      before,
                      'clusters',
                      selection.id,
                      ['arrangement', 'pitch'],
                      at
                    );
                  });
                }}
              />
            </StudioField>
          );
        })}
      {!!keys.length && (
        <>
          <StudioField>
            <span>Selection key size</span>
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
            <span>Horizontal alignment</span>
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
              <option value="auto">Auto (outer edge)</option>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
          </StudioField>
          <StudioField>
            <span>Vertical alignment</span>
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
          edit((before) =>
            adjustSelection(
              before,
              selection,
              [Number(values.get('x')), Number(values.get('y')), 0],
              Number(values.get('rotation')),
              Number(values.get('stagger') || 0)
            )
          );
          form.reset();
        }}
      >
        <small>Relative to current placement, in the parent’s axes.</small>
        <StudioActions>
          {[
            'x',
            'y',
            'rotation',
            ...(selection.section === 'columns' ? ['stagger'] : []),
          ].map((name) => (
            <StudioField key={name}>
              <span>
                {name === 'rotation'
                  ? 'Rotate Δ°'
                  : `${name.toUpperCase()} Δ mm`}
              </span>
              <input
                aria-label={`Relative ${name}`}
                name={name}
                type="number"
                step="any"
                defaultValue="0"
              />
            </StudioField>
          ))}
        </StudioActions>
        <button type="submit">Apply relative adjustment</button>
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
                  checked={keys.every(
                    (id) =>
                      !!getValue(source, [
                        'layout',
                        'objects',
                        id,
                        'footprints',
                        `studio_${kind}`,
                      ])
                  )}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    edit((before) =>
                      keys.reduce((next, id) => {
                        const options = keyOptions(
                          next,
                          readStudio(next).layout.objects?.[id]?.cluster
                        );
                        const diode = !!getValue(next, [
                          'layout',
                          'objects',
                          id,
                          'footprints',
                          'studio_diode',
                        ]);
                        const led = !!getValue(next, [
                          'layout',
                          'objects',
                          id,
                          'footprints',
                          'studio_led',
                        ]);
                        return keyElectronics(next, id, {
                          ...options,
                          diodeAt:
                            (getValue(next, [
                              'layout',
                              'objects',
                              id,
                              'footprints',
                              'studio_diode',
                              'placement',
                              'at',
                            ]) as number[]) || options.diodeAt,
                          ledAt:
                            (getValue(next, [
                              'layout',
                              'objects',
                              id,
                              'footprints',
                              'studio_led',
                              'placement',
                              'at',
                            ]) as number[]) || options.ledAt,
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
