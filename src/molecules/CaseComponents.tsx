import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { CaseConfig, BoardInventory } from '../types/case';
import { CaseAssets, findAsset, readAssets } from '../utils/caseAssets';
import { SourcePath } from '../utils/designSource';
import Field, { CaseHelp } from './CaseField';
type Props = {
  board?: BoardInventory;
  spec: CaseConfig;
  assets: CaseAssets;
  onAssets: Dispatch<SetStateAction<CaseAssets>>;
  onEdit: (path: SourcePath, value: unknown) => void;
  onConfig: (source: string) => void;
};
type ModelInfo = {
  source?: string;
  bounds: number[][];
  stl: string;
  vrml: string;
  error?: string;
};
const INFO_PREFIX = '__model_';
export default function CaseComponents({
  board,
  spec,
  assets,
  onAssets,
  onEdit,
  onConfig,
}: Props) {
  const [selected, setSelected] = useState(''),
    [fileName, setFileName] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const [scale, setScale] = useState(1),
    [offset, setOffset] = useState([0, 0, 0]),
    [rotation, setRotation] = useState([0, 0, 0]);
  const worker = useRef<Worker | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      worker.current?.terminate();
    };
  }, []);
  const inspect = (name: string, pool: CaseAssets): Promise<ModelInfo> => {
    const cached = pool[`${INFO_PREFIX}${name}.json`];
    if (cached && JSON.parse(cached).source === pool[name]) {
      return Promise.resolve(JSON.parse(cached));
    }
    return new Promise((resolve, reject) => {
      worker.current?.terminate();
      const owned = new Worker(
        new URL('../workers/model.worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.current = owned;
      owned.onmessage = ({ data }) => {
        owned.terminate();
        worker.current = null;
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve({ ...data, source: pool[name] });
        }
      };
      owned.onerror = (event) => {
        owned.terminate();
        worker.current = null;
        reject(new Error(event.message));
      };
      owned.postMessage({ name, source: pool[name] });
    });
  };
  const importFile = async (file: File) => {
    setBusy(`Importing ${file.name}…`);
    setError('');
    try {
      const imported = await readAssets(file);
      if (!mounted.current) {
        return;
      }
      onAssets((previous) => ({ ...previous, ...imported.assets }));
      if (imported.config) {
        onConfig(imported.config);
      }
      const first = Object.keys(imported.assets).find((name) =>
        /\.(step|stp|stl|wrl|vrml)$/i.test(name)
      );
      if (first) {
        setFileName(first);
      }
    } catch (error) {
      setError(String(error));
    } finally {
      if (mounted.current) {
        setBusy('');
      }
    }
  };
  const associate = async (
    id = selected,
    name = fileName,
    transform = { scale: [scale, scale, scale], offset, rotate: rotation }
  ) => {
    if (!id || !name) {
      return;
    }
    setBusy(`Reading ${name}…`);
    setError('');
    try {
      const info = await inspect(name, assets);
      if (!mounted.current) {
        return;
      }
      const matrix = new Matrix4().compose(
        new Vector3(...transform.offset),
        new Quaternion().setFromEuler(
          new Euler(
            ...(transform.rotate.map((v) => (-v * Math.PI) / 180) as [
              number,
              number,
              number,
            ]),
            'ZYX'
          )
        ),
        new Vector3(...transform.scale)
      );
      const box = new Box3(
          new Vector3(...info.bounds[0]),
          new Vector3(...info.bounds[1])
        ).applyMatrix4(matrix),
        size = box.getSize(new Vector3()),
        center = box.getCenter(new Vector3());
      if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
        throw new Error(
          'A component body needs nonzero width, length and height.'
        );
      }
      const target = /\.stl$/i.test(name)
        ? name.replace(/\.stl$/i, '.wrl')
        : name;
      onAssets((previous) => ({
        ...previous,
        [`${INFO_PREFIX}${name}.json`]: JSON.stringify(info),
        ...(/\.stl$/i.test(name) ? { [target]: info.vrml } : {}),
      }));
      onEdit(['board'], {
        ...spec.board,
        models: {
          ...spec.board?.models,
          [id]: {
            path: '${KIPRJMOD}/models/' + target,
            ...transform,
            asset: name,
          },
        },
        components: {
          ...spec.board?.components,
          [id]: {
            ...spec.board?.components?.[id],
            size: [size.x, size.y],
            height: [box.min.z, box.max.z],
            body_offset: [center.x, center.y],
            asset: name,
          },
        },
      });
    } catch (error) {
      setError(String(error));
    } finally {
      if (mounted.current) {
        setBusy('');
      }
    }
  };
  // An exact existing model path can be resolved from an imported asset bundle.
  const automatic = useRef(new Set<string>());
  const associateRef = useRef(associate);
  associateRef.current = associate;
  useEffect(() => {
    if (busy || !board) {
      return;
    }
    for (const component of board.components) {
      const linked = spec.board?.components?.[component.id]?.asset;
      if (
        linked &&
        assets[`${INFO_PREFIX}${linked}.json`] &&
        JSON.parse(assets[`${INFO_PREFIX}${linked}.json`]).source ===
          assets[linked]
      ) {
        continue;
      }
      if (!component.populated) {
        continue;
      }
      let match;
      try {
        match = component.models
          .map((model) => ({ model, name: findAsset(model.path, assets) }))
          .find((item) => item.name);
      } catch (caught) {
        setError(String(caught));
        continue;
      }
      if (!match?.name) {
        continue;
      }
      const { model, name } = match;
      const key = `${component.id}:${name}:${assets[name]}`;
      if (automatic.current.has(key)) {
        continue;
      }
      automatic.current.add(key);
      void associateRef.current(component.id, name, model);
      break;
    }
  }, [busy, board, spec.board?.components, assets]);
  return (
    <section aria-label="Board components">
      <h3>PCB and components</h3>
      <label>
        Import models or project ZIP
        <input
          type="file"
          accept=".step,.stp,.stl,.wrl,.vrml,.zip,.kicad_pcb"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void importFile(file);
            }
          }}
        />
      </label>
      {busy && <p role="status">{busy}</p>}
      {error && <p role="alert">{error}</p>}
      {!board ? (
        <p>
          Select a generated board or import a KiCad PCB in Layout. Models
          attach to placed footprint references.
        </p>
      ) : (
        <>
          <p>
            PCB thickness: {board.thickness} mm ·{' '}
            {board.components.filter((c) => c.populated).length} populated
            components
          </p>
          <Field
            label="Component footprint"
            value={selected}
            choices={[
              '',
              ...board.components.filter((c) => c.populated).map((c) => c.id),
            ]}
            onChange={(value) => setSelected(String(value))}
          />
          <p>
            {board.components.find((c) => c.id === selected)?.reference}{' '}
            {board.components.find((c) => c.id === selected)?.footprint}
          </p>
          <Field
            label="Component model"
            value={fileName}
            choices={[
              '',
              ...Object.keys(assets).filter((name) =>
                /\.(step|stp|stl|wrl|vrml)$/i.test(name)
              ),
            ]}
            onChange={(value) => setFileName(String(value))}
          />
          <Field
            label="Model scale (mm per source unit)"
            value={scale}
            onChange={(value) => setScale(Number(value))}
          />
          {[0, 1, 2].map((axis) => (
            <div key={axis}>
              <Field
                label={`Model ${'XYZ'[axis]} offset (mm)`}
                value={offset[axis]}
                onChange={(value) =>
                  setOffset((previous) =>
                    previous.map((v, i) => (i === axis ? Number(value) : v))
                  )
                }
              />
              <Field
                label={`Model ${'XYZ'[axis]} rotation (degrees)`}
                value={rotation[axis]}
                onChange={(value) =>
                  setRotation((previous) =>
                    previous.map((v, i) => (i === axis ? Number(value) : v))
                  )
                }
              />
            </div>
          ))}
          <button
            disabled={!selected || !fileName || !!busy}
            onClick={() => void associate()}
          >
            Associate model and update envelope
          </button>
          <CaseHelp label="Component model" />
          {board.components.some((c) => c.populated && c.family) && (
            <details>
              <summary>Keycap clearance</summary>
              <p>
                Enter the measured outer envelope, including the skirt. Height
                limits are relative to the top of the switch plate. Until
                supplied, keycap clearance remains unresolved.
              </p>
              {['Width', 'Length', 'Bottom', 'Top'].map((label, index) => {
                const property = index < 2 ? 'size' : 'height';
                const axis = index % 2;
                return (
                  <Field
                    key={label}
                    label={`Keycap ${label.toLowerCase()} (mm)`}
                    value={spec.board?.keycaps?.[property]?.[axis] ?? ''}
                    onChange={(value) => {
                      const values = [
                        ...(spec.board?.keycaps?.[property] || ['', '']),
                      ];
                      values[axis] = value;
                      onEdit(['board', 'keycaps', property], values);
                    }}
                  />
                );
              })}
            </details>
          )}
          <h3>Resolved and missing envelopes</h3>
          {board.components
            .filter((c) => c.populated)
            .map((component) => {
              const definition = spec.board?.components?.[component.id] || {},
                size = definition.size || component.size,
                height = definition.height || component.height;
              return (
                <details key={component.id} open={!size || !height}>
                  <summary>
                    {component.reference} · {component.footprint} ·{' '}
                    {size && height ? 'envelope available' : 'needs dimensions'}{' '}
                    · {component.side} ·{' '}
                    {spec.board?.models?.[component.id]?.asset
                      ? 'model associated'
                      : component.models.length
                        ? 'model needs import'
                        : 'reference envelope'}
                  </summary>
                  {!spec.board?.models?.[component.id]?.asset &&
                    component.models.length > 0 && (
                      <p>
                        Import the referenced model or use the measured
                        envelope:{' '}
                        {component.models.map((model) => model.path).join(', ')}
                      </p>
                    )}
                  {[0, 1].map((axis) => (
                    <Field
                      key={axis}
                      label={`${component.reference} ${axis ? 'length' : 'width'} (mm)`}
                      value={size?.[axis] ?? ''}
                      onChange={(value) => {
                        const next = [...(size || [0, 0])];
                        next[axis] = value;
                        onEdit(['board', 'components', component.id], {
                          ...definition,
                          size: next,
                        });
                      }}
                    />
                  ))}
                  {[0, 1].map((axis) => (
                    <Field
                      key={axis}
                      label={`${component.reference} ${axis ? 'top' : 'bottom'} above PCB face (mm)`}
                      value={height?.[axis] ?? ''}
                      onChange={(value) => {
                        const next = [...(height || [0, 0])];
                        next[axis] = value;
                        onEdit(['board', 'components', component.id], {
                          ...definition,
                          height: next,
                        });
                      }}
                    />
                  ))}
                  <button onClick={() => setSelected(component.id)}>
                    Attach model to {component.reference}
                  </button>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!definition.opening}
                      onChange={(event) =>
                        onEdit(['board', 'components', component.id], {
                          ...definition,
                          opening: event.target.checked,
                        })
                      }
                    />
                    Create a linked case opening
                  </label>
                </details>
              );
            })}
        </>
      )}
    </section>
  );
}
