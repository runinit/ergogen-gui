import type { LayoutReport } from 'ergogen/src/native';
import { useState } from 'react';
import { Copy, Trash2, Plus } from 'lucide-react';
import { StudioActions, StudioField } from './StudioStyles';
import type { StudioSelection } from './StudioCanvas';
import {
  StudioDoc,
  getValue,
  setValue,
  removeValue,
  resizeCluster,
  removeObject,
  duplicateObject,
  nextId,
} from '../utils/studioSource';
import ColumnInspector from './ColumnInspector';
import DimensionField from './DimensionField';
import {
  pitchUnits,
  ensurePitchUnits,
  type Dimension,
} from '../utils/designUnits';
import SelectionControls from './SelectionControls';
import { unlinkRelation } from '../utils/layoutRelations';
import LayoutDefaults from './LayoutDefaults';
import { KEY_SIZES } from '../utils/keySizes';
import { sizeSelection } from '../utils/studioSelection';
import { matrixNames } from '../utils/studioSource';
import { targets } from '../utils/studioTargets';
import { setLayout } from '../utils/layoutSource';
import type { SourcePath } from '../utils/designSource';

type Props = {
  source: string;
  data: StudioDoc;
  selection: StudioSelection;
  report?: LayoutReport;
  edit: (transform: (source: string) => string) => void;
  select: (value: StudioSelection) => void;
};
const dimensions = ['X', 'Y', 'Z'];
export default function StudioInspector({
  source,
  data,
  selection,
  report,
  edit,
  select,
}: Props) {
  const { section, id } = selection;
  const [newName, setNewName] = useState('');
  const [resizeAttempt, setResizeAttempt] = useState(0);
  if (selection.members && targets(selection).length > 1) {
    return (
      <>
        <h2>{targets(selection).length} selected</h2>
        <SelectionControls
          source={source}
          selection={selection}
          report={report}
          edit={edit}
        />
        <p>
          Ctrl/Cmd toggles items. Shift selects a range. Drag any selected item
          to move the set.
        </p>
      </>
    );
  }
  const objectSection = section === 'objects' || section === 'clusters';
  const item = objectSection ? data.layout[section]?.[id] : undefined;
  const resolved = objectSection ? report?.[section]?.[id] : undefined;
  const inherited =
    section === 'objects' &&
    !!data.layout.clusters?.[item?.cluster || '']?.locked;
  const locked = !!item?.locked || inherited;
  const profileFrom = data.designs?.profiles?.[id]?.from;
  const boundary =
    section === 'outline' &&
    typeof profileFrom === 'string' &&
    profileFrom.startsWith('boundaries.')
      ? profileFrom.slice('boundaries.'.length)
      : '';
  const path = objectSection
    ? ['layout', section, id]
    : section === 'parameters'
      ? ['units', id]
      : section === 'outline'
        ? ['designs', boundary ? 'boundaries' : 'profiles', boundary || id]
        : ['layout', section, id];
  const patch = (field: SourcePath, value: unknown) =>
    edit((before) => {
      if (
        typeof value === 'string' &&
        !['label', 'part', 'footprints'].includes(String(field[0])) &&
        /(?:[0-9]|\b)[uv]\b/.test(value)
      ) {
        before = ensurePitchUnits(before);
      }
      if (locked && field[0] !== 'locked') {
        throw new Error('This object is locked.');
      }
      if (
        section === 'objects' &&
        item?.kind === 'key' &&
        field.slice(0, 3).join('.') === 'envelopes.keycap.size'
      ) {
        const current = getValue(before, [
          ...path,
          'envelopes',
          'keycap',
          'size',
        ]) ||
          getValue(before, [
            'parts',
            item.part || '',
            'envelopes',
            'keycap',
            'size',
          ]) || [18, 18];
        const size = Array.isArray(value)
          ? value
          : [...(current as (number | string)[])];
        if (!Array.isArray(value)) {
          size[Number(field[3])] = value as number | string;
        }
        return sizeSelection(
          before,
          { section: 'objects', id },
          size,
          undefined,
          report
        );
      }
      const last = field.at(-1);
      if (
        typeof last === 'number' &&
        !Array.isArray(getValue(before, [...path, ...field.slice(0, -1)]))
      ) {
        const parent = field.slice(0, -1),
          name = parent.at(-1);
        const inherited = item?.part
          ? getValue(before, ['parts', item.part, ...parent])
          : undefined;
        if (name === 'height' && last === 0 && !Array.isArray(inherited)) {
          throw new Error('Set the body top height first.');
        }
        const defaults =
          name === 'at' ? [0, 0, 0] : name === 'size' ? [18, 18] : [0, 0];
        const values = Array.isArray(inherited) ? [...inherited] : defaults;
        values[last] = value;
        return objectSection
          ? setLayout(before, section, id, parent, values)
          : setValue(before, [...path, ...parent], values);
      }
      if (
        field[0] === 'placement' &&
        ['above', 'below'].includes(String(field[1]))
      ) {
        before = removeValue(before, [
          ...path,
          'placement',
          field[1] === 'above' ? 'below' : 'above',
        ]);
      }
      if (objectSection && item) {
        return setLayout(before, section, id, field, value);
      }
      return setValue(before, [...path, ...field], value);
    });
  const field = (
    label: string,
    fieldPath: SourcePath,
    fallback: unknown = '',
    options?: { text?: boolean; actual?: number; list?: boolean }
  ) => {
    const value = getValue(source, [...path, ...fieldPath]) ?? fallback;
    if (
      !options?.text &&
      !options?.list &&
      (typeof value === 'number' ||
        fieldPath[0] === 'placement' ||
        fieldPath[0] === 'arrangement' ||
        label === 'Value')
    ) {
      return (
        <DimensionField
          key={`${id}-${label}`}
          label={label}
          value={value as Dimension}
          units={pitchUnits(source)}
          disabled={locked}
          suffix={
            label.toLowerCase().includes('angle') || label === 'Rotation'
              ? '°'
              : 'mm'
          }
          onCommit={(next) => patch(fieldPath, next)}
        />
      );
    }
    return (
      <StudioField key={`${label}-${JSON.stringify(value)}`}>
        <span>{label}</span>
        <input
          aria-label={label}
          defaultValue={String(value)}
          disabled={locked && label !== 'Label'}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next === String(value) || !next) {
              return;
            }
            patch(
              fieldPath,
              options?.list
                ? next
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                : options?.text
                  ? next
                  : Number.isFinite(Number(next))
                    ? Number(next)
                    : next
            );
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
        {options?.actual !== undefined && (
          <small>
            = {Number(options.actual.toFixed(3))}{' '}
            {label.toLowerCase().includes('angle') || label === 'Rotation'
              ? '°'
              : 'mm'}
          </small>
        )}
      </StudioField>
    );
  };
  const references = [
    'world',
    ...Object.keys(data.layout.clusters || {}).map((id) => `clusters.${id}`),
    ...Object.keys(data.layout.objects || {}),
  ];
  const reference = (
    label: string,
    fieldPath: SourcePath,
    choices = references
  ) => {
    const current = String(getValue(source, [...path, ...fieldPath]) || '');
    return (
      <StudioField>
        <span>{label}</span>
        <select
          aria-label={label}
          disabled={locked}
          value={current}
          onChange={(event) =>
            event.target.value
              ? patch(fieldPath, event.target.value)
              : edit((before) => removeValue(before, [...path, ...fieldPath]))
          }
        >
          <option value="">None</option>
          {Array.from(new Set([current, ...choices].filter(Boolean))).map(
            (ref) => (
              <option key={ref} value={ref}>
                {data.layout.objects?.[ref]?.label ||
                  data.layout.clusters?.[ref.replace(/^clusters\./, '')]
                    ?.label ||
                  ref}
              </option>
            )
          )}
        </select>
      </StudioField>
    );
  };
  if (section === 'columns') {
    return (
      <>
        <ColumnInspector
          source={source}
          data={data}
          selection={selection}
          edit={edit}
          select={select}
        />
        <SelectionControls
          source={source}
          selection={selection}
          report={report}
          edit={edit}
        />
      </>
    );
  }
  if (section === 'parameters') {
    return (
      <>
        <h2>Parameters</h2>
        <p>Use names in dimensions to keep the design linked.</p>
        {Object.keys(data.units || {}).map((name) => (
          <StudioField key={`${name}-${data.units![name]}`}>
            <span>{name}</span>
            <input
              aria-label={`Parameter ${name}`}
              defaultValue={String(data.units![name])}
              onBlur={(event) => {
                const text = event.target.value.trim();
                if (text && text !== String(data.units![name])) {
                  edit((before) =>
                    setValue(
                      before,
                      ['units', name],
                      Number.isFinite(Number(text)) ? Number(text) : text
                    )
                  );
                }
              }}
            />
            <small>
              {report && 'units' in report
                ? String((report.units as Record<string, number>)?.[name] ?? '')
                : ''}
            </small>
          </StudioField>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const name = newName.trim();
            if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name)) {
              return;
            }
            edit((before) => setValue(before, ['units', name], 0));
            setNewName('');
          }}
        >
          <StudioField>
            <span>New parameter</span>
            <input
              aria-label="New parameter"
              pattern="[A-Za-z_][A-Za-z_0-9]*"
              required
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </StudioField>
          <button type="submit" disabled={!newName || !!data.units?.[newName]}>
            <Plus size={16} />
            Add parameter
          </button>
        </form>
      </>
    );
  }
  if (section === 'constraints') {
    const rule = data.layout.constraints?.[id];
    if (!rule) {
      return (
        <>
          <h2>Constraints</h2>
          <p>
            Select objects and use Align and constrain to keep their centers
            aligned or evenly spaced. Advanced rules can be edited here.
          </p>
        </>
      );
    }
    const types = {
      aligned: 'Center alignment',
      distance: 'Distance',
      angle: 'Angle',
      coincident: 'Coincident',
      horizontal: 'Horizontal alignment',
      vertical: 'Vertical alignment',
      equal_spacing: 'Equal spacing',
      symmetric: 'Symmetry',
    };
    return (
      <>
        <h2>{rule.label || id}</h2>
        {field('Label', ['label'], id, { text: true })}
        <StudioField>
          <span>Rule</span>
          <select
            aria-label="Constraint type"
            value={rule.type}
            onChange={(event) => {
              const type = event.target.value,
                refs = [...rule.refs];
              const count = ['equal_spacing', 'symmetric'].includes(type)
                ? 3
                : 2;
              while (refs.length < count) {
                refs.push(
                  references.find((ref) => !refs.includes(ref)) || 'world'
                );
              }
              edit((before) =>
                setValue(before, ['layout', 'constraints', id], {
                  type,
                  refs: refs.slice(0, count),
                  ...(['distance', 'angle'].includes(type)
                    ? { value: rule.value ?? 19 }
                    : {}),
                })
              );
            }}
          >
            {Object.entries(types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </StudioField>
        {rule.refs.map((ref, index) => (
          <StudioField key={index}>
            <span>
              {rule.type === 'symmetric' && index === 2
                ? 'Axis frame'
                : `Reference ${index + 1}`}
            </span>
            <select
              aria-label={`Constraint reference ${index + 1}`}
              value={ref}
              onChange={(event) =>
                patch(
                  ['refs'],
                  rule.refs.map((value, i) =>
                    i === index ? event.target.value : value
                  )
                )
              }
            >
              {Array.from(new Set([...references, ...rule.refs])).map(
                (name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                )
              )}
            </select>
          </StudioField>
        ))}
        {['distance', 'angle'].includes(rule.type) &&
          field('Value', ['value'], 19)}
        {['aligned', 'distance', 'symmetric'].includes(rule.type) && (
          <StudioField>
            <span>Axis</span>
            <select
              aria-label="Constraint axis"
              value={rule.axis || ''}
              onChange={(event) =>
                event.target.value
                  ? patch(['axis'], event.target.value)
                  : edit((before) => removeValue(before, [...path, 'axis']))
              }
            >
              <option value="">
                {rule.type === 'distance' ? 'Direct distance' : 'Frame X axis'}
              </option>
              <option value="x">X</option>
              <option value="y">Y</option>
            </select>
          </StudioField>
        )}
        <StudioActions>
          <button
            onClick={() =>
              edit((before) =>
                report
                  ? unlinkRelation(before, id, report)
                  : removeValue(before, path)
              )
            }
          >
            <Trash2 size={16} />
            Delete constraint
          </button>
        </StudioActions>
      </>
    );
  }
  if (section === 'outline') {
    const profile = (
      boundary
        ? data.designs?.boundaries?.[boundary]
        : data.designs?.profiles?.[id]
    ) as Record<string, unknown> | undefined;
    if (!profile) {
      return (
        <>
          <h2>Board outline</h2>
          <p>
            Select a board profile, or create a board outline from the object
            tree.
          </p>
        </>
      );
    }
    const corners = getValue(source, [...path, 'corners']) as
      | { fillet?: number | string; chamfer?: number | string }
      | undefined;
    return (
      <>
        <h2>Board outline</h2>
        <p>
          Follow the outside of keys and the support envelopes of components.
        </p>
        {field('Edge clearance', ['clearance'], 2)}
        {field('Close gaps', ['close'], 2)}
        {field('Simplify', ['simplify'], 0)}
        <StudioField>
          <span>Corners</span>
          <select
            aria-label="Outline corners"
            value={
              corners?.chamfer !== undefined
                ? 'chamfer'
                : corners?.fillet !== undefined
                  ? 'fillet'
                  : 'sharp'
            }
            onChange={(event) => {
              edit((before) =>
                event.target.value === 'sharp'
                  ? removeValue(before, [...path, 'corners'])
                  : setValue(before, [...path, 'corners'], {
                      [event.target.value]:
                        corners?.chamfer ?? corners?.fillet ?? 1,
                    })
              );
            }}
          >
            <option value="sharp">Sharp</option>
            <option value="fillet">Fillet</option>
            <option value="chamfer">Chamfer</option>
          </select>
        </StudioField>
        {corners &&
          field(
            corners.chamfer !== undefined ? 'Chamfer size' : 'Fillet radius',
            ['corners', corners.chamfer !== undefined ? 'chamfer' : 'fillet'],
            1
          )}
        <h3>Profile sources</h3>
        <small>Regions define which keys and components contribute.</small>
        {field('Sources', ['from'], profile.from || '', { list: true })}
      </>
    );
  }
  if (section === 'layers') {
    const layer = data.layout.layers?.[id];
    if (!layer) {
      return (
        <>
          <h2>Mounting layers</h2>
          <p>
            Create a layer on a PCB face or case surface, then place components
            on it.
          </p>
        </>
      );
    }
    return (
      <>
        <h2>{id}</h2>
        {field('Surface', ['surface'], 'world', { text: true })}
        {field('Assembly', ['assembly'], '', { text: true })}
        <small>
          Examples: pcb.main.top, case.keyboard.floor, plate.keyboard.top.
        </small>
      </>
    );
  }
  if (!item) {
    return (
      <>
        <h2>Design inspector</h2>
        <p>
          Select a key, cluster, or component on the canvas or in the object
          tree.
        </p>
        <p>
          Use Move to drag; use the fields here for exact dimensions and
          expressions.
        </p>
      </>
    );
  }
  const part = data.parts?.[item.part || ''];
  return (
    <>
      <h2>{item.label || id}</h2>
      <SelectionControls
        source={source}
        selection={selection}
        report={report}
        edit={edit}
      />
      {field('Label', ['label'], id, { text: true })}
      <small>
        {item.kind ||
          (item.mirror
            ? 'Mirrored cluster'
            : `${item.arrangement?.type || 'free'} arrangement`)}
      </small>
      {section === 'clusters' && item.arrangement?.type === 'columns' && (
        <>
          <LayoutDefaults
            source={source}
            cluster={id}
            report={report}
            edit={edit}
          />
          <h3>Arrangement</h3>
          {(['columns', 'rows'] as const).map((name) => (
            <StudioField
              key={`${id}-${name}-${item.arrangement![name]?.length}-${resizeAttempt}`}
            >
              <span>{name === 'columns' ? 'Columns' : 'Rows'}</span>
              <input
                aria-label={`Matrix ${name}`}
                type="number"
                min="1"
                max="100"
                disabled={locked}
                defaultValue={item.arrangement![name]?.length || 1}
                onBlur={(event) => {
                  const count = Number(event.target.value);
                  // Keep the field on the saved size while a removal is reviewed.
                  setResizeAttempt((attempt) => attempt + 1);
                  edit((before) =>
                    resizeCluster(before, id, {
                      [name]: matrixNames(
                        item.arrangement![name] || [],
                        count,
                        name === 'columns' ? 'c' : 'r'
                      ),
                    })
                  );
                }}
              />
            </StudioField>
          ))}
          <p>
            Select a column to adjust splay and offsets, or select a key to edit
            it individually. Nets follow the matrix automatically.
          </p>
          {field('Column pitch', ['arrangement', 'pitch', 0], 19)}
          {field('Row pitch', ['arrangement', 'pitch', 1], 19)}
          {item.arrangement.columns?.map((column, index) => (
            <StudioActions key={column}>
              <button
                onClick={() =>
                  select({ section: 'columns', cluster: id, id: column })
                }
              >
                Column {index + 1} · {column}
              </button>
            </StudioActions>
          ))}
        </>
      )}
      {section === 'clusters' && item.arrangement?.type === 'arc' && (
        <>
          <LayoutDefaults
            source={source}
            cluster={id}
            report={report}
            edit={edit}
          />
          <h3>Arc arrangement</h3>
          {field('Radius', ['arrangement', 'radius'], 45)}
          {field('Start angle', ['arrangement', 'start'], -15)}
          {field('Angular step', ['arrangement', 'step'], 30)}
          <StudioField>
            <span>Key count</span>
            <input
              key={`${id}-count-${Object.values(data.layout.objects || {}).filter((value) => value.cluster === id && value.kind === 'key').length}`}
              aria-label="Arc key count"
              type="number"
              min="1"
              max="100"
              defaultValue={
                Object.values(data.layout.objects || {}).filter(
                  (value) => value.cluster === id && value.kind === 'key'
                ).length
              }
              disabled={locked}
              onBlur={(event) =>
                edit((before) =>
                  resizeCluster(before, id, {
                    count: Number(event.target.value),
                  })
                )
              }
            />
          </StudioField>
        </>
      )}
      {item.mirror && (
        <>
          <h3>Mirror</h3>
          <p>Linked to {item.mirror.source}.</p>
          {field('Mirror axis', ['mirror', 'axis'], 0)}
        </>
      )}
      <h3>Placement</h3>
      {dimensions.map((label, index) =>
        field(
          label,
          section === 'objects' && item.kind === 'key'
            ? ['placement', 'override', 'at', index]
            : ['placement', 'at', index],
          0,
          {
            actual: resolved?.position[index],
          }
        )
      )}
      {field(
        'Rotation',
        section === 'objects' && item.kind === 'key'
          ? ['placement', 'override', 'rotate']
          : ['placement', 'rotate'],
        0
      )}
      {reference('Relative to', ['placement', 'ref'])}
      {reference(
        'Mounting layer',
        ['layer'],
        ['world', ...Object.keys(data.layout.layers || {})]
      )}
      <StudioField>
        <span>Locked</span>
        <input
          type="checkbox"
          aria-label="Locked"
          checked={locked}
          disabled={inherited}
          onChange={(event) => patch(['locked'], event.target.checked)}
        />
      </StudioField>
      {!item.mirror && (
        <>
          <h3>Constraint movement</h3>
          <small>Unchecked coordinates remain driven by their placement.</small>
          {['x', 'y', 'rotate'].map((axis) => (
            <StudioField key={axis}>
              <span>
                Solve {axis === 'rotate' ? 'rotation' : axis.toUpperCase()}
              </span>
              <input
                aria-label={`Solve ${axis}`}
                type="checkbox"
                disabled={locked}
                checked={item.placement?.solve?.includes(axis) || false}
                onChange={(event) =>
                  patch(
                    ['placement', 'solve'],
                    event.target.checked
                      ? [...(item.placement?.solve || []), axis]
                      : (item.placement?.solve || []).filter(
                          (value) => value !== axis
                        )
                  )
                }
              />
            </StudioField>
          ))}
        </>
      )}
      {section === 'objects' && (
        <>
          <h3>Part and board</h3>
          {reference('Part', ['part'], Object.keys(data.parts || {}))}
          {reference('PCB', ['pcb'], Object.keys(data.pcbs || {}))}
          {item.kind === 'key' && (
            <>
              <StudioField>
                <span>Key size preset</span>
                <select
                  aria-label="Key size preset"
                  disabled={locked}
                  value={
                    KEY_SIZES.find((preset) =>
                      preset.size.every(
                        (v, axis) =>
                          v ===
                          (item.envelopes?.keycap?.size ||
                            part?.envelopes?.keycap?.size || [18, 18])[axis]
                      )
                    )?.id || ''
                  }
                  onChange={(event) => {
                    const preset = KEY_SIZES.find(
                      (value) => value.id === event.target.value
                    );
                    if (preset) {
                      patch(['envelopes', 'keycap', 'size'], preset.size);
                    }
                  }}
                >
                  <option value="">Custom</option>
                  {KEY_SIZES.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </StudioField>
              <small>
                Keycap envelope in mm. Switch opening stays unchanged.
              </small>
              {field(
                'Key width',
                ['envelopes', 'keycap', 'size', 0],
                part?.envelopes?.keycap?.size?.[0] || 18
              )}
              {field(
                'Key depth',
                ['envelopes', 'keycap', 'size', 1],
                part?.envelopes?.keycap?.size?.[1] || 18
              )}
              <details>
                <summary>Wiring overrides · automatic by default</summary>
                {field(
                  'Column net',
                  ['properties', 'column_net'],
                  report?.objects[id]?.properties?.column_net || 'Automatic',
                  {
                    text: true,
                  }
                )}
                {field(
                  'Row net',
                  ['properties', 'row_net'],
                  report?.objects[id]?.properties?.row_net || 'Automatic',
                  { text: true }
                )}
              </details>
            </>
          )}
          {item.kind === 'component' && (
            <>
              <h3>Physical envelope</h3>
              {field(
                'Body width',
                ['envelopes', 'body', 'size', 0],
                part?.envelopes?.body?.size?.[0] || 10
              )}
              {field(
                'Body depth',
                ['envelopes', 'body', 'size', 1],
                part?.envelopes?.body?.size?.[1] || 10
              )}
              {field(
                'Body bottom',
                ['envelopes', 'body', 'height', 0],
                part?.envelopes?.body?.height?.[0] ?? 0
              )}
              {field(
                'Body top',
                ['envelopes', 'body', 'height', 1],
                part?.envelopes?.body?.height?.[1] ?? ''
              )}
              <small>
                Height limits are relative to the part origin. Mounting offset
                is separate.
              </small>
              <h3>Vertical stacking</h3>
              {reference(
                'Above',
                ['placement', 'above'],
                Object.keys(data.layout.objects || {})
                  .filter((key) => key !== id)
                  .map((key) => `${key}.body.top`)
              )}
              {reference(
                'Below',
                ['placement', 'below'],
                Object.keys(data.layout.objects || {})
                  .filter((key) => key !== id)
                  .map((key) => `${key}.body.bottom`)
              )}
              {field('Stack gap', ['placement', 'gap'], 0)}
              <h3>Footprint</h3>
              {field('Provider', ['footprints', 'main', 'what'], '', {
                text: true,
              })}
            </>
          )}
        </>
      )}
      <StudioActions>
        <button
          disabled={locked}
          onClick={() => {
            const next = nextId(
              Object.keys(data.layout[section as 'objects' | 'clusters'] || {}),
              `${id}_copy`
            );
            edit((before) =>
              duplicateObject(
                before,
                section as 'objects' | 'clusters',
                id,
                next
              )
            );
            select({ section, id: next });
          }}
        >
          <Copy size={16} />
          Duplicate
        </button>
        <button
          disabled={locked}
          onClick={() =>
            edit((before) =>
              removeObject(before, section as 'objects' | 'clusters', id)
            )
          }
        >
          <Trash2 size={16} />
          Delete
        </button>
      </StudioActions>
    </>
  );
}
