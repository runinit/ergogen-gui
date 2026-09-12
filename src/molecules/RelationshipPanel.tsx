import { useState } from 'react';
import type { LayoutReport } from 'ergogen/src/native';
import type { StudioSelection } from '../utils/studioTargets';
import { targets } from '../utils/studioTargets';
import { readStudio, setValue, nextId } from '../utils/studioSource';
import {
  pitchUnits,
  ensurePitchUnits,
  type Dimension,
} from '../utils/designUnits';
import { unlinkRelation } from '../utils/layoutRelations';
import DimensionField from './DimensionField';
import { StudioActions } from './StudioStyles';

export default function RelationshipPanel({
  source,
  selection,
  report,
  onPick,
  onPropose,
  edit,
}: {
  source: string;
  selection: StudioSelection;
  report: LayoutReport;
  onPick: (id: string, axis: 'x' | 'y') => void;
  onPropose: (source: string) => void;
  edit: (change: (source: string) => string) => void;
}) {
  const [distance, setDistance] = useState<Dimension>('0.5u');
  const [error, setError] = useState('');
  const ids = targets(selection)
    .filter((item) => item.section === 'objects')
    .map((item) => item.id);
  if (!ids.length) {
    return null;
  }
  const data = readStudio(source);
  const related = Object.entries(data.layout.constraints || {}).filter(
    ([, rule]) =>
      rule.refs.some((ref) =>
        ids.includes(ref.replace(/^objects\./, '').replace(/\.center$/, ''))
      )
  );
  const command = (kind: 'distance' | 'equal_spacing') => {
    try {
      const ordered =
        kind === 'distance'
          ? ids.slice(0, 2)
          : [...ids].sort(
              (a, b) =>
                report.objects[a].position[0] - report.objects[b].position[0] ||
                report.objects[a].position[1] - report.objects[b].position[1]
            );
      const moving =
        kind === 'distance' ? ordered.slice(1) : ordered.slice(1, -1);
      let next = ensurePitchUnits(source);
      const name = nextId(Object.keys(data.layout.constraints || {}), kind);
      const owners = moving.map((object) => {
        const item = data.layout.objects?.[object];
        if (!item || report.objects[object]?.locked) {
          throw new Error('Unlock the objects that will move.');
        }
        return {
          object,
          added: ['x', 'y'].filter(
            (axis) => !item.placement?.solve?.includes(axis)
          ),
        };
      });
      for (const owner of owners) {
        next = setValue(
          next,
          ['layout', 'objects', owner.object, 'placement', 'solve'],
          Array.from(
            new Set([
              ...(data.layout.objects?.[owner.object].placement?.solve || []),
              ...owner.added,
            ])
          )
        );
      }
      next = setValue(next, ['layout', 'constraints', name], {
        type: kind,
        refs: ordered.map((id) => `${id}.center`),
        ...(kind === 'distance' ? { value: distance } : {}),
        label:
          kind === 'distance' ? 'Center distance' : 'Evenly spaced centers',
      });
      next = setValue(next, ['meta', 'studio', 'relations', name], { owners });
      onPropose(next);
    } catch (reason) {
      setError(String(reason));
    }
  };
  return (
    <section aria-label="Selection relationships">
      <h3>Align and constrain</h3>
      {ids.length === 1 && (
        <>
          <small>
            Choose an alignment, then click an object or guide on the canvas.
          </small>
          <StudioActions>
            <button
              disabled={report.objects[ids[0]]?.locked}
              onClick={() => onPick(ids[0], 'y')}
            >
              Align vertically
            </button>
            <button
              disabled={report.objects[ids[0]]?.locked}
              onClick={() => onPick(ids[0], 'x')}
            >
              Align horizontally
            </button>
          </StudioActions>
        </>
      )}
      {ids.length >= 2 && (
        <>
          <DimensionField
            label="Center distance"
            value={distance}
            units={pitchUnits(source)}
            onCommit={setDistance}
          />
          <StudioActions>
            <button onClick={() => command('distance')}>Set distance</button>
            {ids.length >= 3 && (
              <button onClick={() => command('equal_spacing')}>
                Distribute evenly
              </button>
            )}
          </StudioActions>
        </>
      )}
      {related.map(([id, rule]) => (
        <div key={id}>
          <p>{rule.label || rule.type}</p>
          <button
            onClick={() => edit((before) => unlinkRelation(before, id, report))}
          >
            Remove relationship · {rule.label || id}
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
