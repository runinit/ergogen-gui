import { parseDocument } from 'yaml';
import type { LayoutReport } from 'ergogen/src/native';
import { editDesign } from '../utils/designSource';
import { setLayout } from '../utils/layoutSource';
import Field from './CaseField';

type Props = {
  source: string;
  assembly: string;
  layout?: LayoutReport;
  onChange: (change: (source: string) => string) => void;
};
export default function NativeCaseObjects({
  source,
  assembly,
  layout,
  onChange,
}: Props) {
  const data = parseDocument(source).toJS();
  const add = (envelope: 'body' | 'service') =>
    onChange((before) => {
      let serial = 1;
      while (data.layout.objects?.[`${assembly}_${envelope}_${serial}`]) {
        serial++;
      }
      const layer = `${assembly}_floor`;
      const withLayer = data.layout.layers?.[layer]
        ? before
        : editDesign(before, ['layout', 'layers', layer], {
            surface: `case.${assembly}.floor`,
            assembly,
          });
      return editDesign(
        withLayer,
        ['layout', 'objects', `${assembly}_${envelope}_${serial}`],
        {
          kind: 'component',
          layer,
          envelopes: {
            [envelope]: {
              size: [18, 10],
              ...(envelope === 'service' ? { height: [0, 5] } : {}),
            },
          },
        }
      );
    });
  return (
    <>
      <p>
        Components belong to physical mounting layers. Enter measured body
        heights to validate clearance. Service envelopes cut shell openings.
      </p>
      <button onClick={() => add('body')}>Add component</button>{' '}
      <button onClick={() => add('service')}>Add opening</button>
      {Object.values(layout?.objects || {})
        .filter(
          (item) => item.kind === 'component' && data.layout.objects?.[item.id]
        )
        .map((item) => (
          <fieldset key={item.id} disabled={item.locked}>
            <legend>{item.label}</legend>
            <Field
              label={`${item.label} mounting layer`}
              value={item.layer}
              choices={['world', ...Object.keys(layout?.layers || {})]}
              onChange={(value) =>
                onChange((before) =>
                  setLayout(before, 'objects', item.id, ['layer'], value)
                )
              }
            />
            {['body', 'service']
              .filter((name) => item.envelopes[name])
              .map((name) => {
                const envelope = item.envelopes[name];
                return (
                  <div key={name}>
                    <p>{name === 'body' ? 'Measured body' : 'Shell opening'}</p>
                    {['size', 'height'].flatMap((field) =>
                      [0, 1].map((index) => {
                        const values =
                          envelope[field as 'size' | 'height'] ||
                          (field === 'size' ? [18, 10] : [0, undefined]);
                        return (
                          <Field
                            key={`${field}-${index}`}
                            label={`${item.label} ${name} ${field === 'size' ? ['width', 'length'][index] : ['bottom', 'top'][index]} (mm)`}
                            value={values[index] ?? ''}
                            onChange={(value) =>
                              onChange((before) => {
                                const vector: unknown[] = [...values];
                                vector[index] = value;
                                if (
                                  vector.some(
                                    (v) => v === undefined || v === ''
                                  )
                                ) {
                                  throw new Error('Enter both dimensions.');
                                }
                                return setLayout(
                                  before,
                                  'objects',
                                  item.id,
                                  ['envelopes', name, field],
                                  vector
                                );
                              })
                            }
                          />
                        );
                      })
                    )}
                  </div>
                );
              })}
            <small>
              Move this object in Layout. YAML contains its placement and
              stacking relationships.
            </small>
          </fieldset>
        ))}
    </>
  );
}
