import DimensionField from './DimensionField';
import { pitchUnits, ensurePitchUnits } from '../utils/designUnits';
import { StudioActions, StudioField } from './StudioStyles';
import { KEY_SIZES } from '../utils/keySizes';
import {
  keyOptions,
  setKeyOptions,
  keyElectronics,
  KeyOptions,
} from '../utils/keyOptions';
import { sizeSelection, selectedKeys } from '../utils/studioSelection';
import { setLayout } from '../utils/layoutSource';
import type { LayoutReport } from 'ergogen/src/native';
import { readStudio } from '../utils/studioSource';

export default function LayoutDefaults({
  source,
  cluster = '',
  report,
  edit,
}: {
  source: string;
  cluster?: string;
  report?: LayoutReport;
  edit: (change: (source: string) => string) => void;
}) {
  const options = keyOptions(source, cluster);
  const matrix =
    !cluster ||
    readStudio(source).layout.clusters?.[cluster]?.arrangement?.type ===
      'columns';
  const patch = (values: Partial<KeyOptions>) =>
    edit((before) => setKeyOptions(before, values, cluster));
  return (
    <details>
      <summary>
        {cluster
          ? matrix
            ? 'Matrix defaults'
            : 'Cluster defaults'
          : 'Layout defaults'}
      </summary>
      <small>
        {cluster
          ? 'Used by new keys in this cluster.'
          : 'Used by new matrices and loose keys.'}
      </small>
      {matrix && (
        <>
          <StudioField>
            <span>Spacing preset</span>
            <select
              aria-label="Default spacing preset"
              value=""
              onChange={(event) => {
                const pitch = Number(event.target.value);
                if (pitch > 0) {
                  patch({ pitch: [pitch, pitch] });
                }
              }}
            >
              <option value="">Choose spacing</option>
              <option value="19.05">MX · 19.05 mm</option>
              <option value="19">Compact · 19 mm</option>
              <option value="18">Tight · 18 mm</option>
            </select>
          </StudioField>
          {(['Column spacing', 'Row spacing'] as const).map((label, index) => (
            <DimensionField
              key={`${cluster}-${label}`}
              label={`Default ${label.toLowerCase()}`}
              value={options.pitch[index]}
              units={pitchUnits(source)}
              onCommit={(value) => {
                const pitch = [...options.pitch];
                pitch[index] = value;
                edit((before) =>
                  setKeyOptions(ensurePitchUnits(before), { pitch }, cluster)
                );
              }}
            />
          ))}
        </>
      )}
      <StudioField>
        <span>Default key size</span>
        <select
          aria-label="Default key size"
          value={
            KEY_SIZES.find((p) => p.size.every((v, i) => v === options.size[i]))
              ?.id || ''
          }
          onChange={(event) => {
            const preset = KEY_SIZES.find((p) => p.id === event.target.value);
            if (preset) {
              patch({ size: preset.size });
            }
          }}
        >
          <option value="">Custom</option>
          {KEY_SIZES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </StudioField>
      {(['diode', 'led'] as const).map((kind) => (
        <div key={kind}>
          <StudioField>
            <span>{kind === 'diode' ? 'Include diode' : 'Include LED'}</span>
            <input
              aria-label={`Default ${kind}`}
              type="checkbox"
              checked={options[kind]}
              onChange={(event) => patch({ [kind]: event.target.checked })}
            />
          </StudioField>
          {options[kind] && (
            <StudioActions>
              {['X', 'Y'].map((axis, index) => (
                <StudioField key={`${axis}-${options[`${kind}At`][index]}`}>
                  <span>
                    {kind} {axis}
                  </span>
                  <input
                    type="number"
                    step="any"
                    aria-label={`Default ${kind} offset ${axis}`}
                    defaultValue={options[`${kind}At`][index]}
                    onBlur={(event) => {
                      const at = [...options[`${kind}At`]];
                      at[index] = Number(event.target.value);
                      if (Number.isFinite(at[index])) {
                        patch({ [`${kind}At`]: at });
                      }
                    }}
                  />
                </StudioField>
              ))}
            </StudioActions>
          )}
        </div>
      ))}
      {cluster && (
        <button
          onClick={() =>
            edit((before) => {
              const options = keyOptions(before, cluster),
                selection = { section: 'clusters' as const, id: cluster };
              let next = matrix
                ? setLayout(
                    before,
                    'clusters',
                    cluster,
                    ['arrangement', 'pitch'],
                    options.pitch
                  )
                : before;
              next = sizeSelection(
                next,
                selection,
                options.size,
                undefined,
                report
              );
              return selectedKeys(next, selection).reduce(
                (value, id) => keyElectronics(value, id, options),
                next
              );
            })
          }
        >
          Apply defaults to {matrix ? 'matrix' : 'cluster'}
        </button>
      )}
    </details>
  );
}
