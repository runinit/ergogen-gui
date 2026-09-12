import manifest from '../../public/components/manifest.json';
import { loadComponentModel } from '../utils/componentModels';
import { modelPreview } from '../utils/cachedModelPreview';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { ModelBinding, Vec3 } from '../types/footprint';
import { findAsset, type CaseAssets } from '../utils/caseAssets';
import { readFootprintFiles, prepareModel } from '../utils/footprintService';
import { fetchModel, modelUrl } from '../utils/modelSources';
import { librarySnapshot } from '../utils/footprintLibrary';
import { theme } from '../theme/theme';

const Axes = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${theme.spacing.sm};
  label {
    font-size: ${theme.fontSizes.bodySmall};
  }
`;
const Editor = styled.div`
  > label {
    display: grid;
    gap: ${theme.spacing.xs};
  }
  > div {
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.sm};
  }
  > div button {
    padding: ${theme.spacing.sm};
    font-size: ${theme.fontSizes.bodySmall};
  }
  > p {
    font-size: ${theme.fontSizes.bodySmall};
    color: ${theme.colors.textDarker};
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: ${theme.spacing.lg} 0;
    min-width: 0;
  }
  legend {
    font-size: ${theme.fontSizes.bodySmall};
    color: ${theme.colors.textDark};
    padding: 0;
    margin-bottom: ${theme.spacing.sm};
  }
  details {
    border-top: 1px solid ${theme.colors.border};
    margin-top: ${theme.spacing.md};
  }
  input,
  select {
    width: 100%;
  }
`;
type Props = {
  models: ModelBinding[];
  assets: CaseAssets;
  selected: number;
  onSelect: (index: number) => void;
  onBusy?: (state: 'busy' | 'idle') => void;
  onChange: (models: ModelBinding[], assets: CaseAssets) => void;
};

// Keep unfinished numbers local so typing does not fight model updates.
function ModelNumber({
  value,
  label,
  step,
  min,
  onCommit,
}: {
  value: number;
  label: string;
  step: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      aria-label={label}
      step={step}
      min={min}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={(event) => {
        const next = event.currentTarget.valueAsNumber;
        if (!Number.isFinite(next) || (min !== undefined && next < min)) {
          setText(String(value));
          return;
        }
        setText(String(next));
        if (next !== value) {
          onCommit(next);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.currentTarget.value = String(value);
          setText(String(value));
          event.currentTarget.blur();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
export default function ModelEditor({
  models,
  assets,
  selected,
  onSelect,
  onChange,
  onBusy,
}: Props) {
  const [url, setUrl] = useState('');
  const [bundled, setBundled] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    onBusy?.(busy ? 'busy' : 'idle');
  }, [busy, onBusy]);
  const [replace, setReplace] = useState<number | null>(null);
  const operation = useRef<AbortController>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const update = (model: ModelBinding) =>
    onChange(
      models.map((previous, index) => (index === selected ? model : previous)),
      assets
    );
  const importSources = async (
    sources: { name: string; source: string; url?: string }[],
    slot: number | null
  ) => {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setError('');
    const chosen = slot ?? models.length;
    const next = [...models];
    let collected = { ...assets };
    try {
      for (const source of sources) {
        setBusy(`Reading ${source.name}…`);
        const imported = await prepareModel(
          source.name,
          source.source,
          controller.signal,
          source.url
        );
        collected = { ...collected, ...imported.assets };
        if (slot !== null) {
          next[slot] = {
            ...imported.model,
            offset: models[slot].offset,
            rotate: models[slot].rotate,
            scale: models[slot].scale,
          };
          slot = null;
        } else {
          next.push(imported.model);
        }
      }
      controller.signal.throwIfAborted();
      onChange(next, collected);
      onSelect(chosen);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(String(error));
      }
    } finally {
      if (operation.current === controller) {
        setBusy('');
      }
    }
  };
  const download = async (source: string, slot: number | null = null) => {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy('Downloading model…');
    setError('');
    try {
      const local = findAsset(source, assets);
      if (local) {
        await importSources([{ name: local, source: assets[local] }], slot);
        return;
      }
      const normalized = modelUrl(source);
      const cached = librarySnapshot()
        .flatMap((entry) =>
          entry.models.map((model) => ({ model, assets: entry.assets }))
        )
        .find((item) => item.model.sourceUrl === normalized);
      if (cached) {
        const next =
          slot === null
            ? [...models, cached.model]
            : models.map((model, index) =>
                index === slot
                  ? {
                      ...cached.model,
                      offset: model.offset,
                      rotate: model.rotate,
                      scale: model.scale,
                    }
                  : model
              );
        onChange(next, { ...assets, ...cached.assets });
        onSelect(slot ?? models.length);
        return;
      }
      const downloaded = await fetchModel(source, controller.signal);
      await importSources([{ ...downloaded, url: normalized }], slot);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(String(error));
      }
    } finally {
      if (operation.current === controller) {
        setBusy('');
      }
    }
  };
  const model = models[selected];
  return (
    <Editor>
      <label>
        Model
        <select
          aria-label="Active model"
          disabled={!!busy}
          value={selected}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {!models.length && <option value={-1}>No model attached</option>}
          {models.map((model, index) => (
            <option key={index} value={index}>
              {index + 1}. {model.path.split('/').at(-1)}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          disabled={!!busy}
          onClick={() => {
            setReplace(null);
            input.current?.click();
          }}
        >
          Add models
        </button>
        {model && (
          <>
            <button
              disabled={!!busy}
              onClick={() => {
                setReplace(selected);
                input.current?.click();
              }}
            >
              Replace
            </button>
            <button
              disabled={!!busy}
              onClick={() => {
                onChange(
                  models.filter((_, index) => index !== selected),
                  assets
                );
                onSelect(Math.max(0, selected - 1));
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept=".step,.stp,.stl,.wrl,.vrml,.zip"
        aria-label="Upload 3D models"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          operation.current?.abort();
          const controller = new AbortController();
          operation.current = controller;
          setBusy('Reading files…');
          void readFootprintFiles(files, controller.signal)
            .then((files) => {
              controller.signal.throwIfAborted();
              return importSources(
                files.filter((file) => file.kind === 'model'),
                replace
              );
            })
            .catch((error) => {
              if (!controller.signal.aborted) {
                setError(String(error));
                setBusy('');
              }
            });
        }}
      />
      <p>STEP, STL or VRML · original files are retained.</p>
      {model && (
        <>
          {(['offset', 'rotate', 'scale'] as const).map((property) => (
            <fieldset key={property} disabled={!!busy}>
              <legend>
                {property === 'offset'
                  ? 'Position (mm)'
                  : property === 'rotate'
                    ? 'Rotation (°)'
                    : 'Scale'}
              </legend>
              <Axes>
                {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                  <label key={axis}>
                    {axis}
                    <ModelNumber
                      key={`${selected}:${model.path}:${property}:${axis}`}
                      label={`Model ${property} ${axis}`}
                      step={property === 'rotate' ? 1 : 0.1}
                      min={property === 'scale' ? 0.001 : undefined}
                      value={model[property][index]}
                      onCommit={(value) => {
                        const vector = [...model[property]] as Vec3;
                        vector[index] = value;
                        update({ ...model, [property]: vector });
                      }}
                    />
                  </label>
                ))}
              </Axes>
            </fieldset>
          ))}
          <p>
            Origin (0, 0, 0) is marked by the axes. Drag the matching canvas
            controls to align the model.
          </p>
          {!modelPreview(model, assets) && (
            <p role="status">
              Model unavailable locally. Dimensions and clearance remain
              unchecked.{' '}
              <button
                onClick={() => {
                  setUrl(model.path);
                  void download(model.path, selected);
                }}
              >
                Resolve model reference
              </button>
              {/\.wrl$/i.test(model.path) && model.path.startsWith('${') && (
                <button
                  onClick={() => {
                    const source = model.path.replace(/\.wrl$/i, '.step');
                    setUrl(source);
                    void download(source, selected);
                  }}
                >
                  Use official STEP version
                </button>
              )}
            </p>
          )}
        </>
      )}
      <details>
        <summary>Bundled models</summary>
        <label>
          Bundled model
          <select
            value={bundled}
            onChange={(event) => setBundled(event.target.value)}
          >
            <option value="">Choose model</option>
            {manifest.models.map((model) => (
              <option key={model.file} value={model.file}>
                {model.file}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!bundled || !!busy}
          onClick={async () => {
            operation.current?.abort();
            const controller = new AbortController();
            operation.current = controller;
            setBusy('Loading bundled model…');
            setError('');
            try {
              const imported = await loadComponentModel(bundled);
              controller.signal.throwIfAborted();
              onChange([...models, imported.model], {
                ...assets,
                ...imported.assets,
              });
              onSelect(models.length);
            } catch (reason) {
              if (!controller.signal.aborted) {
                setError(String(reason));
              }
            } finally {
              if (operation.current === controller) {
                setBusy('');
              }
            }
          }}
        >
          Add bundled model
        </button>
        <p>
          Source models retain their original origin. Confirm alignment and
          mounting height.
        </p>
        {bundled.startsWith('Nice_') && (
          <p>
            CC BY-NC-SA 4.0 · noncommercial use. nice!nano: Joe Scotto /
            infused-kim. nice!view: TweetyDaBird / infused-kim.
          </p>
        )}
      </details>
      <details>
        <summary>KiCad reference or public URL</summary>
        <label>
          Model source
          <input
            aria-label="Model source URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="${KICAD10_3DMODEL_DIR}/… or https://…"
          />
        </label>
        <button disabled={!url || !!busy} onClick={() => void download(url)}>
          Import from URL
        </button>
        <p>
          <a
            href="https://www.kicad.org/libraries/download/"
            target="_blank"
            rel="noreferrer"
          >
            Official KiCad libraries
          </a>{' '}
          · saved models use cached files.
        </p>
      </details>
      {busy && (
        <p role="status">
          {busy}{' '}
          <button
            onClick={() => {
              operation.current?.abort();
              setBusy('');
            }}
          >
            Cancel import
          </button>
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => void download(url)} disabled={!url}>
            Retry
          </button>{' '}
          <button onClick={() => input.current?.click()}>Upload file</button>
        </p>
      )}
    </Editor>
  );
}
