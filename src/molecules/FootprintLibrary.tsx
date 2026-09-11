import { footprintUses, linkFootprint } from '../utils/footprintLinks';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useConfigContext } from '../context/ConfigContext';
import { useFootprintLibrary } from '../hooks/useFootprintLibrary';
import {
  createEntry,
  entryInjection,
  linkedUses,
  saveFootprint,
  packageLibrary,
} from '../utils/footprintLibrary';
import {
  prepareFootprint,
  prepareBundle,
  countUses,
  readFootprintFiles,
  ImportFile,
} from '../utils/footprintService';
import { packageAssets, saveAssets } from '../utils/caseAssets';
import type {
  FootprintInfo,
  LibraryEntry,
  ModelBinding,
} from '../types/footprint';
import ModelEditor from './ModelEditor';
import FootprintCanvas from './FootprintCanvas';
import bundled from '../../.generated/footprints.json';
import { theme } from '../theme/theme';

const Layout = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: ${theme.cad.treeWidth} minmax(0, 1fr) ${theme.cad
      .inspectorWidth};
  flex: 1;
  min-height: 0;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    grid-template-columns: 1fr;
    overflow: auto;
  }
`;
const Panel = styled.aside<{
  $drawer?: 'catalog' | 'inspector';
  $open?: boolean;
}>`
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    ${({ $drawer, $open }) =>
      $drawer
        ? `display:${$open ? 'block' : 'none'}; position:absolute; top:0; bottom:0; ${$drawer === 'catalog' ? 'left' : 'right'}:0; width:min(86vw,${theme.cad.inspectorWidth}); z-index:${theme.cad.drawerLayer}; background:${theme.colors.background}; box-sizing:border-box;`
        : ''}
  }

  padding: ${theme.spacing.md};
  overflow: auto;
  border-right: 1px solid ${theme.colors.border};
  border-left: 1px solid ${theme.colors.border};
  h2 {
    overflow-wrap: anywhere;
  }
  label {
    display: block;
    margin-bottom: ${theme.spacing.md};
  }
  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
  }
  fieldset {
    margin: ${theme.spacing.md} 0;
    padding: ${theme.spacing.sm};
    border: 1px solid ${theme.colors.border};
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: ${theme.fontSizes.bodySmall};
  }
  td,
  th {
    text-align: left;
    padding: ${theme.spacing.sm};
    border-bottom: 1px solid ${theme.colors.border};
  }
  small,
  p {
    color: ${theme.colors.textDarker};
    line-height: 1.5;
  }
`;
const MobileAction = styled.button`
  display: none;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    display: inline-flex;
  }
`;
const Catalog = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  margin: ${theme.spacing.md} 0;
  button {
    text-align: left;
    word-break: break-word;
  }
  button[aria-pressed='true'] {
    background: ${theme.colors.accentDarker};
  }
`;
const Center = styled.main`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: ${theme.caseWizard.solidHeight};
  > div[aria-label='Footprint preview'] {
    flex: 1;
  }
`;
const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md};
  button[aria-pressed='true'] {
    border-color: ${theme.colors.accent};
  }
`;
const Inset = styled.div`
  position: absolute;
  bottom: ${theme.spacing.md};
  left: ${theme.spacing.md};
  width: ${theme.cad.insetWidth};
  height: ${theme.cad.insetHeight};
  border: 1px solid ${theme.colors.accent};
  border-radius: ${theme.caseWizard.radius};
  overflow: hidden;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    display: none;
  }
`;
type Batch = ImportFile & {
  checked: boolean;
  status?: string;
  draft?: LibraryEntry;
};
type Props = {
  onPreview?: () => void;
  initialQuery?: string;
  source?: string;
  onSource?: (source: string) => void;
};
export default function FootprintLibrary({
  onPreview,
  initialQuery = '',
  source,
  onSource,
}: Props) {
  const context = useConfigContext();
  const { entries, error: storageError } = useFootprintLibrary();
  const [linkIndex, setLinkIndex] = useState('');
  const projectSource = source ?? context?.getRealtimeConfigInput() ?? '';
  const projectUses = footprintUses(projectSource);
  const layout = useRef<HTMLDivElement>(null);
  const catalogButton = useRef<HTMLButtonElement>(null);
  const inspectorButton = useRef<HTMLButtonElement>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const closeDrawer = () => {
    (catalogOpen ? catalogButton : inspectorButton).current?.focus();
    setCatalogOpen(false);
    setInspectorOpen(false);
  };
  useEffect(() => {
    if (
      !window.matchMedia(`(max-width: ${theme.caseWizard.smallScreen})`).matches
    ) {
      return;
    }
    const panel = catalogOpen
      ? 'Footprint library catalog'
      : inspectorOpen
        ? 'Footprint inspector'
        : '';
    layout.current
      ?.querySelector<HTMLElement>(`aside[aria-label="${panel}"] button`)
      ?.focus();
  }, [catalogOpen, inspectorOpen]);
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState<LibraryEntry>();
  const [info, setInfo] = useState<FootprintInfo>();
  const [parameters, setParameters] = useState<
    Record<string, { type: string; value: unknown }>
  >({});
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [yaml, setYaml] = useState('');
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<'model' | 'pads'>('model');
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const [side, setSide] = useState<'F' | 'B'>('F');
  const [mode, setMode] = useState<'translate' | 'rotate' | 'scale'>(
    'translate'
  );
  const [pad, setPad] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [batch, setBatch] = useState<Batch[]>([]);
  const [bundleFiles, setBundleFiles] = useState<ImportFile[]>([]);
  const [impact, setImpact] = useState<{
    placements: number;
    projects: number;
    unchecked: number;
  }>();
  const [busy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState<'busy' | 'idle'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const drafts = useRef(new Map<string, LibraryEntry>());
  const history = useRef<LibraryEntry[]>([]);
  const operation = useRef<AbortController>();
  const current = useRef(draft);
  current.current = draft;
  useEffect(() => () => operation.current?.abort(), []);
  const edit = (next: LibraryEntry) => {
    if (draft) {
      history.current.push(draft);
    }
    drafts.current.set(next.id, next);
    setDraft(next);
    setStatus('Unsaved footprint draft');
  };
  const open = (entry: LibraryEntry) => {
    setCatalogOpen(false);
    setInspectorOpen(true);
    if (draft) {
      drafts.current.set(draft.id, draft);
    }
    setDraft(drafts.current.get(entry.id) || entry);
    setInfo(undefined);
    setError('');
    setStatus('');
    setParams({});
    history.current = [];
    setActive(0);
  };
  const geometryRevision = JSON.stringify([
    draft?.id,
    draft?.module,
    draft?.mapping,
    draft?.origin.kind,
    draft?.origin.original,
    draft?.target,
    params,
  ]);
  useEffect(() => {
    const entry = current.current;
    if (!entry) {
      return;
    }
    const controller = new AbortController();
    setInspecting(true);
    void prepareFootprint(
      { ...entry, modelMode: 'preserve' },
      controller.signal,
      params
    )
      .then((prepared) => {
        if (controller.signal.aborted) {
          return;
        }
        setInfo(prepared.info);
        setParameters(prepared.parameters);
        setYaml(prepared.yaml);
        setInspecting(false);
        setError('');
        setDraft((previous) =>
          previous?.id === entry.id
            ? {
                ...previous,
                module: prepared.module,
                mapping: prepared.mapping,
                models:
                  previous.modelMode === 'preserve' && !previous.models.length
                    ? prepared.info.models
                    : previous.models,
              }
            : previous
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(String(error));
          setInspecting(false);
        }
      });
    return () => controller.abort();
    // The serialized geometry revision intentionally excludes immediate model transforms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryRevision]);
  const available = useMemo(
    () => [
      ...Object.entries(bundled).map(([name, source]) => ({
        name,
        source,
        kind: 'Bundled',
      })),
      ...(context?.injectionInput || [])
        .filter(
          (row) => row[0] === 'footprint' && !row[1].startsWith('library/')
        )
        .map((row) => ({ name: row[1], source: row[2], kind: 'Project' })),
    ],
    [context?.injectionInput]
  );
  const filtered = available.filter((entry) =>
    entry.name.toLowerCase().includes(query.toLowerCase())
  );
  const uses = draft
    ? linkedUses(
        (context?.configs || []).map((project) =>
          project.id === context?.activeConfigId
            ? { ...project, config: projectSource }
            : project
        ),
        draft.alias
      )
    : { projects: 0, declarations: 0 };
  const countRevision = JSON.stringify([
    (context?.configs || []).map((project) => ({
      config:
        project.id === context?.activeConfigId ? projectSource : project.config,
    })),
    draft?.alias,
  ]);
  useEffect(() => {
    const [projects, alias] = JSON.parse(countRevision);
    if (!alias) {
      return;
    }
    const controller = new AbortController();
    setImpact(undefined);
    void countUses(projects, alias, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setImpact(value);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [countRevision]);
  const importFiles = async (files: File[]) => {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      const sources = await readFootprintFiles(files, controller.signal);
      controller.signal.throwIfAborted();
      setBundleFiles(sources);
      setBatch(
        sources
          .filter((source) => source.kind !== 'model')
          .map((source) => ({ ...source, checked: true }))
      );
      if (!sources.some((source) => source.kind !== 'model')) {
        setError('No .kicad_mod or Ergogen .js footprints found.');
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(String(error));
      }
    } finally {
      if (operation.current === controller) {
        setBusy(false);
      }
    }
  };
  const convertBatch = async () => {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    for (const item of batch.filter((item) => item.checked)) {
      if (controller.signal.aborted) {
        break;
      }
      try {
        const entry = createEntry(
          item.name.replace(/\.(kicad_mod|js)$/i, ''),
          item.source,
          item.kind === 'kicad' ? 'kicad' : 'ergogen'
        );
        const prepared = await prepareFootprint(entry, controller.signal);
        const models = await prepareBundle(
          prepared.info.models,
          bundleFiles,
          controller.signal
        );
        const preparedDraft = {
          ...entry,
          module: prepared.module,
          resolved: prepared.resolved,
          mapping: prepared.mapping,
          ...models,
        };
        setBatch((previous) =>
          previous.map((row) =>
            row.name === item.name
              ? {
                  ...row,
                  status: 'Prepared · review and save',
                  draft: preparedDraft,
                }
              : row
          )
        );
        drafts.current.set(entry.id, preparedDraft);
      } catch (error) {
        if (!controller.signal.aborted) {
          setBatch((previous) =>
            previous.map((row) =>
              row.name === item.name ? { ...row, status: String(error) } : row
            )
          );
        }
      }
    }
    setBusy(false);
  };
  const save = async () => {
    if (!draft) {
      return;
    }
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      const prepared = await prepareFootprint(draft, controller.signal, params);
      controller.signal.throwIfAborted();
      await saveAssets(draft.assets);
      const saved = await saveFootprint({
        ...draft,
        module: prepared.module,
        resolved: prepared.resolved,
        mapping: prepared.mapping,
      });
      drafts.current.delete(saved.id);
      setDraft(saved);
      history.current = [];
      const injection = entryInjection(saved);
      context?.setInjectionInput((previous) => [
        ...(previous || []).filter((row) => row[1] !== saved.alias),
        injection,
      ]);
      setStatus(
        `Saved revision ${saved.revision}. Linked projects use this revision.`
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(String(error));
      }
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!draft) {
      return;
    }
    const controller = new AbortController();
    const prepared = await prepareFootprint(draft, controller.signal, params);
    const zip = new JSZip();
    zip.file(`footprints/${draft.alias}.js`, prepared.resolved);
    zip.file('usage.yaml', prepared.yaml);
    packageAssets(zip, draft.assets);
    const exported = { ...draft, resolved: prepared.resolved };
    packageLibrary(zip, [entryInjection(exported)], [exported]);
    saveAs(
      await zip.generateAsync({ type: 'blob' }),
      `${draft.name.replace(/[^A-Za-z0-9_-]/g, '_')}.zip`
    );
  };
  const changeModel = (model: ModelBinding) =>
    draft &&
    edit({
      ...draft,
      modelMode: 'replace',
      models: draft.models.map((previous, index) =>
        index === active ? model : previous
      ),
    });
  return (
    <Layout
      ref={layout}
      onKeyDown={(event) => {
        if (
          !(catalogOpen || inspectorOpen) ||
          !window.matchMedia(`(max-width: ${theme.caseWizard.smallScreen})`)
            .matches
        ) {
          return;
        }
        if (event.key === 'Escape') {
          event.stopPropagation();
          closeDrawer();
        }
        if (event.key !== 'Tab') {
          return;
        }
        const panel = catalogOpen
          ? 'Footprint library catalog'
          : 'Footprint inspector';
        const controls = Array.from(
          layout.current?.querySelectorAll<HTMLElement>(
            `aside[aria-label="${panel}"] button:not(:disabled), aside[aria-label="${panel}"] input:not(:disabled), aside[aria-label="${panel}"] select:not(:disabled), aside[aria-label="${panel}"] textarea, aside[aria-label="${panel}"] a[href]`
          ) || []
        ).filter((item) => item.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        event.stopPropagation();
      }}
    >
      <Panel
        $drawer="catalog"
        $open={catalogOpen}
        aria-label="Footprint library catalog"
      >
        <MobileAction onClick={closeDrawer}>Close catalog</MobileAction>
        <h2>Footprint library</h2>
        <label>
          Search footprints
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button onClick={() => fileInput.current?.click()}>
          Import KiCad footprint
        </button>{' '}
        <button onClick={() => folderInput.current?.click()}>
          Import folder
        </button>
        <input
          hidden
          ref={fileInput}
          type="file"
          multiple
          accept=".kicad_mod,.js,.zip"
          aria-label="Import footprint files"
          onChange={(event) => {
            void importFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        <input
          hidden
          ref={folderInput}
          type="file"
          multiple
          {...{ webkitdirectory: '' }}
          aria-label="Import .pretty folder"
          onChange={(event) => {
            void importFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        {!!batch.length && (
          <section>
            <h3>Import selection</h3>
            {batch.map((item) => (
              <div key={item.name}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) =>
                      setBatch((previous) =>
                        previous.map((row) =>
                          row.name === item.name
                            ? { ...row, checked: event.target.checked }
                            : row
                        )
                      )
                    }
                  />
                  {item.name}
                </label>
                <small>{item.status}</small>
                {item.draft && (
                  <button onClick={() => open(item.draft!)}>
                    Review {item.name}
                  </button>
                )}
              </div>
            ))}
            <button
              disabled={busy || !batch.some((item) => item.checked)}
              onClick={() => void convertBatch()}
            >
              Prepare selected
            </button>
          </section>
        )}
        <h3>Your footprints ({entries.length})</h3>
        <Catalog>
          {entries
            .filter((entry) =>
              entry.name.toLowerCase().includes(query.toLowerCase())
            )
            .map((entry) => (
              <button
                key={entry.id}
                aria-pressed={draft?.id === entry.id}
                onClick={() => open(entry)}
              >
                {entry.name}
                <small> · r{entry.revision}</small>
              </button>
            ))}
        </Catalog>
        <h3>Bundled & project ({filtered.length})</h3>
        <Catalog>
          {filtered.map((entry) => (
            <button
              key={`${entry.kind}:${entry.name}`}
              onClick={() =>
                open(createEntry(entry.name, entry.source, 'ergogen'))
              }
            >
              {entry.name}
              <small> · {entry.kind}</small>
            </button>
          ))}
        </Catalog>
      </Panel>
      <Center>
        <Toolbar>
          <MobileAction
            ref={catalogButton}
            onClick={() => {
              setCatalogOpen(true);
              setInspectorOpen(false);
            }}
          >
            Catalog
          </MobileAction>
          <MobileAction
            ref={inspectorButton}
            onClick={() => {
              setInspectorOpen(true);
              setCatalogOpen(false);
            }}
          >
            Inspector
          </MobileAction>
          {(['3d', '2d'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
          {(['translate', 'rotate', 'scale'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value === 'translate'
                ? 'Move'
                : value === 'rotate'
                  ? 'Rotate'
                  : 'Scale'}
            </button>
          ))}
          <button
            aria-pressed={side === 'B'}
            onClick={() =>
              setSide((previous) => (previous === 'F' ? 'B' : 'F'))
            }
          >
            {side === 'F' ? 'Front' : 'Back'} side
          </button>
        </Toolbar>
        {draft ? (
          <FootprintCanvas
            info={info}
            models={draft.models}
            assets={draft.assets}
            selected={active}
            onSelect={setActive}
            onChange={changeModel}
            mode={mode}
            view={view}
            pad={pad}
            onPad={(value) => {
              setPad(value);
              setTab('pads');
            }}
            side={side}
          />
        ) : (
          <Panel as="div">
            <h2>Prepare a reusable footprint</h2>
            <p>
              Choose a bundled footprint to customize, or import a KiCad
              footprint. Map its pads, align its models, then save it for every
              linked project.
            </p>
          </Panel>
        )}
        {draft?.models.some(
          (model) => draft.assets[`__model_${model.asset}.json`]
        ) &&
          view === '3d' && (
            <Inset aria-label="Magnified model alignment">
              <FootprintCanvas
                info={info}
                models={draft.models.filter((_, index) => index === active)}
                assets={draft.assets}
                selected={0}
                onSelect={() => {}}
                side={side}
              />
            </Inset>
          )}
      </Center>
      <Panel
        $drawer="inspector"
        $open={inspectorOpen}
        aria-label="Footprint inspector"
      >
        <MobileAction onClick={closeDrawer}>Close inspector</MobileAction>
        {draft && (
          <>
            <h2>{draft.name}</h2>
            <p>
              {draft.revision
                ? `Library footprint · revision ${draft.revision}`
                : 'New user footprint · unsaved'}
            </p>
            <Toolbar>
              <button
                aria-pressed={tab === 'model'}
                onClick={() => setTab('model')}
              >
                3D models
              </button>
              <button
                aria-pressed={tab === 'pads'}
                onClick={() => {
                  setTab('pads');
                  setView('2d');
                }}
              >
                Pads & nets
              </button>
            </Toolbar>
            {info && info.targets.length > 1 && (
              <label>
                Emitted footprint target
                <select
                  value={JSON.stringify(draft.target || {})}
                  onChange={(event) =>
                    edit({ ...draft, target: JSON.parse(event.target.value) })
                  }
                >
                  <option value="{}">Choose one footprint</option>
                  {info.targets.map((target, index) => (
                    <option
                      key={index}
                      value={JSON.stringify({
                        name: target.name,
                        index: target.index,
                        count: target.count,
                      })}
                    >
                      {target.reference || target.name || index}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tab === 'model' ? (
              <ModelEditor
                key={draft.id}
                onBusy={setModelBusy}
                models={draft.models}
                assets={draft.assets}
                selected={active}
                onSelect={setActive}
                onChange={(models, assets) =>
                  edit({ ...draft, models, assets, modelMode: 'replace' })
                }
              />
            ) : (
              <>
                <p>
                  {info?.pads.length || 0} pads · duplicate numbers share a net.
                  Mechanical pads remain separate.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Pad</th>
                      <th>Net parameter</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info?.nets.map((net) => (
                      <tr key={net.number}>
                        <td>
                          <button
                            aria-pressed={pad === net.number}
                            onClick={() => setPad(net.number)}
                          >
                            {net.number}
                          </button>
                        </td>
                        <td>
                          {draft.origin.kind === 'kicad' ? (
                            <input
                              aria-label={`Pad ${net.number} net parameter`}
                              value={draft.mapping[net.number] || net.parameter}
                              onChange={(event) =>
                                edit({
                                  ...draft,
                                  mapping: {
                                    ...draft.mapping,
                                    [net.number]: event.target.value,
                                  },
                                })
                              }
                            />
                          ) : (
                            <span>Defined by body(p)</span>
                          )}
                        </td>
                        <td>{net.pads.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  {info?.pads.filter((p) => p.mechanical).length || 0}{' '}
                  mechanical pads · no net assignment
                </p>
              </>
            )}
            {info?.pads.some(
              (pad) =>
                !['rect', 'roundrect', 'circle', 'oval'].includes(pad.shape)
            ) && (
              <p role="status">
                Custom and trapezoid pad outlines have a simplified preview. The
                exported footprint retains their original geometry.
              </p>
            )}
            {info?.diagnostics.map((finding, index) => (
              <p
                key={index}
                role={finding.severity === 'error' ? 'alert' : 'status'}
              >
                {finding.message}
              </p>
            ))}
            <details>
              <summary>Parameters & source</summary>
              <label>
                Library name
                <input
                  value={draft.name}
                  onChange={(event) =>
                    edit({ ...draft, name: event.target.value })
                  }
                />
              </label>
              {Object.entries(parameters)
                .filter(([, parameter]) =>
                  ['string', 'number', 'boolean', 'net'].includes(
                    parameter.type
                  )
                )
                .map(([key, parameter]) => (
                  <label key={key}>
                    {key}
                    <input
                      value={String(params[key] ?? parameter.value)}
                      onChange={(event) =>
                        setParams((previous) => ({
                          ...previous,
                          [key]:
                            parameter.type === 'number'
                              ? Number(event.target.value)
                              : parameter.type === 'boolean'
                                ? event.target.value === 'true'
                                : event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              <label>
                Ergogen module
                <textarea
                  aria-label="Footprint module source"
                  rows={10}
                  value={draft.module}
                  readOnly={draft.origin.kind === 'kicad'}
                  onChange={(event) =>
                    edit({ ...draft, module: event.target.value })
                  }
                />
              </label>
              <pre>{yaml}</pre>
              <button
                onClick={() =>
                  void download().catch((error) => setError(String(error)))
                }
              >
                Export footprint ZIP
              </button>
            </details>
            <p>
              {impact
                ? `${impact.placements} linked placements · ${impact.projects} projects${impact.unchecked ? ` · ${impact.unchecked} project counts unavailable` : ''}`
                : `${uses.declarations} linked declarations · ${uses.projects} projects · counting placements…`}
            </p>
            <button
              onClick={() => void save()}
              disabled={
                busy ||
                modelBusy === 'busy' ||
                !info ||
                (info.targets.length > 1 &&
                  draft.modelMode === 'replace' &&
                  !draft.target)
              }
            >
              Save footprint
            </button>{' '}
            <button
              disabled={!history.current.length}
              onClick={() => {
                const previous = history.current.pop();
                if (previous) {
                  setDraft(previous);
                }
              }}
            >
              Undo footprint edit
            </button>
            {draft.revision > 0 && (
              <>
                <fieldset>
                  <legend>Link to this project</legend>
                  <label>
                    Footprint declaration
                    <select
                      value={linkIndex}
                      onChange={(event) => setLinkIndex(event.target.value)}
                    >
                      <option value="">Choose a declaration</option>
                      {projectUses.map((use, index) => (
                        <option key={use.path.join('.')} value={index}>
                          {use.path.slice(1, -1).join(' / ')} · {use.what}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Only this declaration changes. Its net parameters and
                    instance overrides are retained.
                  </p>
                  <button
                    disabled={linkIndex === ''}
                    onClick={() => {
                      const use = projectUses[Number(linkIndex)];
                      if (!use || !context) {
                        return;
                      }
                      try {
                        const next = linkFootprint(
                          projectSource,
                          use,
                          draft.alias
                        );
                        if (onSource) {
                          onSource(next);
                        } else {
                          context.updateRealtimeConfigInput(next);
                          context.setConfigInput(next);
                        }
                        setStatus(
                          'Linked. Preview in case to inspect the updated footprint.'
                        );
                      } catch (error) {
                        setError(String(error));
                      }
                    }}
                  >
                    Link selected declaration
                  </button>
                </fieldset>
                <button onClick={onPreview}>Preview in case</button>
              </>
            )}
          </>
        )}
        {(status || busy || inspecting) && (
          <p role="status">
            {inspecting
              ? 'Inspecting footprint…'
              : status || 'Preparing import…'}
          </p>
        )}
        {busy && (
          <button
            onClick={() => {
              operation.current?.abort();
              setBusy(false);
            }}
          >
            Cancel import
          </button>
        )}
        {(error || storageError) && <p role="alert">{error || storageError}</p>}
      </Panel>
    </Layout>
  );
}
