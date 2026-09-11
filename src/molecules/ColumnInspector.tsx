import { StudioActions, StudioField } from './StudioStyles';
import {
  addCell,
  matrixNames,
  getValue,
  removeObject,
  resizeCluster,
  StudioDoc,
} from '../utils/studioSource';
import { setLayout } from '../utils/layoutSource';
import type { StudioSelection } from './StudioCanvas';

export default function ColumnInspector({
  source,
  data,
  selection,
  edit,
  select,
}: {
  source: string;
  data: StudioDoc;
  selection: StudioSelection;
  edit: (change: (source: string) => string) => void;
  select: (value: StudioSelection) => void;
}) {
  const cluster = selection.cluster || '',
    column = selection.id;
  const spec = data.layout.clusters?.[cluster],
    arrangement = spec?.arrangement;
  if (!spec || !arrangement?.columns?.includes(column)) {
    return <p>Select a matrix column.</p>;
  }
  const patch = (path: (string | number)[], value: unknown) =>
    edit((before) =>
      setLayout(before, 'clusters', cluster, ['arrangement', ...path], value)
    );
  const dimension = (
    label: string,
    path: (string | number)[],
    fallback: number
  ) => {
    const value =
      getValue(source, [
        'layout',
        'clusters',
        cluster,
        'arrangement',
        ...path,
      ]) ?? fallback;
    return (
      <StudioField key={`${cluster}-${column}-${label}-${value}`}>
        <span>{label}</span>
        <input
          aria-label={label}
          disabled={spec.locked}
          defaultValue={String(value)}
          onBlur={(event) => {
            const text = event.target.value.trim();
            if (!text || text === String(value)) {
              return;
            }
            const next = Number.isFinite(Number(text)) ? Number(text) : text;
            if (path[0] === 'offsets') {
              const offsets = (getValue(source, [
                'layout',
                'clusters',
                cluster,
                'arrangement',
                'offsets',
                column,
              ]) || [0, 0, 0]) as (number | string)[];
              patch(
                ['offsets', column],
                offsets.map((v, i) => (i === path[2] ? next : v))
              );
            } else {
              patch(path, next);
            }
          }}
        />
      </StudioField>
    );
  };
  return (
    <>
      <h2>Column {arrangement.columns.indexOf(column) + 1}</h2>
      <p>
        {cluster} · {column}. Changes affect every key in this column.
      </p>
      {dimension('Column splay', ['splay', column], 0)}
      {dimension('Column stagger', ['stagger', column], 0)}
      {['X', 'Y', 'Z'].map((label, index) =>
        dimension(`Column offset ${label}`, ['offsets', column, index], 0)
      )}
      <p>
        Splay rotates the column about its first row. Individual key edits stay
        relative to the column.
      </p>
      <h3>Keys</h3>
      {arrangement.rows?.map((row, index) => {
        const key = Object.entries(data.layout.objects || {}).find(
          ([, item]) =>
            item.cluster === cluster &&
            item.cell?.[0] === column &&
            item.cell?.[1] === row
        );
        return (
          <StudioActions key={row}>
            {key ? (
              <>
                <button
                  onClick={() => select({ section: 'objects', id: key[0] })}
                >
                  Row {index + 1} · {key[1].label || key[0]}
                </button>
                <button
                  aria-label={`Remove ${key[0]}`}
                  disabled={spec.locked}
                  onClick={() =>
                    edit((before) => removeObject(before, 'objects', key[0]))
                  }
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                disabled={spec.locked}
                onClick={() =>
                  edit((before) => addCell(before, cluster, column, row))
                }
              >
                Add key in row {index + 1}
              </button>
            )}
          </StudioActions>
        );
      })}
      <StudioActions>
        <button
          disabled={spec.locked}
          onClick={() =>
            edit((before) =>
              resizeCluster(before, cluster, {
                columns: matrixNames(
                  arrangement.columns!,
                  arrangement.columns!.length + 1,
                  'c'
                ),
              })
            )
          }
        >
          Add column
        </button>
        <button
          disabled={spec.locked}
          onClick={() =>
            edit((before) =>
              resizeCluster(before, cluster, {
                rows: matrixNames(
                  arrangement.rows || [],
                  (arrangement.rows?.length || 0) + 1,
                  'r'
                ),
              })
            )
          }
        >
          Add row
        </button>
        <button onClick={() => select({ section: 'clusters', id: cluster })}>
          Matrix size and pitch
        </button>
        <button
          disabled={spec.locked || arrangement.columns.length === 1}
          onClick={() =>
            edit((before) =>
              resizeCluster(before, cluster, {
                columns: arrangement.columns!.filter((id) => id !== column),
              })
            )
          }
        >
          Delete column
        </button>
      </StudioActions>
    </>
  );
}
