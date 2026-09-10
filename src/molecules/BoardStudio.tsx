import { ResizeReview, type ResizeProposal } from '../utils/resizeReview';
import { repairSetup } from '../utils/setupRepair';
import { keySetup } from '../utils/keyOptions';
import ResizeReviewDialog from './ResizeReviewDialog';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Code2,
  Component,
  Cpu,
  Download,
  FolderOpen,
  GitBranch,
  LayoutGrid,
  ListTree,
  Plus,
  Redo2,
  Settings,
  SlidersHorizontal,
  Undo2,
  Variable,
  X,
} from 'lucide-react';
import { useConfigContext } from '../context/ConfigContext';
import { useCaseAnalysis, useLayoutAnalysis } from '../hooks/useCasePreview';
import {
  getValue,
  readStudio,
  addCluster,
  moveColumn,
  addObject,
  addOutline,
  nextId,
  setValue,
  StudioDoc,
} from '../utils/studioSource';
import { moveLayout } from '../utils/layoutSource';
import StudioExport from './StudioExport';
import ConfigEditor from './ConfigEditor';
import UpdateChip from '../atoms/UpdateChip';
import InstallChip from '../atoms/InstallChip';
import CaseWizard from './CaseWizard';
import FilePreview from './FilePreview';
import StudioCanvas, { StudioSelection } from './StudioCanvas';
import StudioInspector from './StudioInspector';
import NewDesignWorkspace from './NewDesignWorkspace';
import { defaultSetup, type DesignSetup } from '../utils/designSetup';
import { applyAssembly } from '../utils/applyAssembly';
import { selectedKeys } from '../utils/studioSelection';
import { updateSetup } from '../utils/updateSetup';
import ClusterTree from './ClusterTree';
import LayoutDefaults from './LayoutDefaults';
import SelectionPopover from './SelectionPopover';
import { placeNewItem } from '../utils/studioPlacement';
import {
  StudioShell,
  StudioBar,
  StudioHeader,
  StageNav,
  StudioBody,
  StudioPane,
  StudioMain,
  StudioActions,
  StudioField,
  TreeButton,
  StudioStatus,
} from './StudioStyles';
import { theme } from '../theme/theme';
const FootprintLibrary = lazy(() => import('./FootprintLibrary'));
const DesignView = lazy(() => import('./DesignView'));
const stages = [
  ['layout', 'Layout', LayoutGrid],
  ['components', 'Components', Component],
  ['pcb', 'PCB', Cpu],
  ['case', 'Case', Box],
  ['export', 'Export', Download],
] as const;
type Stage = (typeof stages)[number][0];
const EMPTY: StudioDoc = { schema: 'ergogen/v1', layout: {} };

export default function BoardStudio({
  onUpdate,
  onInstall,
}: { onUpdate?: () => void; onInstall?: () => void } = {}) {
  const context = useConfigContext();
  const source = context?.configInput || '';
  const parsed = useMemo(() => {
    try {
      return { data: readStudio(source), error: '' };
    } catch (error) {
      return { data: EMPTY, error: String(error) };
    }
  }, [source]);
  const data = parsed.data;
  const [stage, setStage] = useState<Stage>('layout');
  const [selection, setSelection] = useState<StudioSelection>({
    section: Object.keys(data.layout.clusters || {}).length
      ? 'clusters'
      : 'objects',
    id:
      Object.keys(data.layout.clusters || {})[0] ||
      Object.keys(data.layout.objects || {})[0] ||
      '',
  });
  const [sheet, setSheet] = useState<'tree' | 'inspector' | ''>('');
  const [code, setCode] = useState(false);
  const [library, setLibrary] = useState(false);
  const [sketch, setSketch] = useState(false);
  const [side, setSide] = useState<'top' | 'side'>('top');
  const [pcbView, setPcbView] = useState<'outline' | 'pcb'>('outline');
  const assets = context?.projectAssets || {};
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState('columns');
  const [newName, setNewName] = useState('');
  const [matrixSize, setMatrixSize] = useState({ columns: 5, rows: 4 });
  const [review, setReview] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [assemblyKeys, setAssemblyKeys] = useState<string[]>([]);
  const [resizeReview, setResizeReview] = useState<{
    proposal: ResizeProposal;
    finish: (source: string) => void;
  } | null>(null);
  const repaired = useRef(new Set<string>());
  const editSource = context?.editSource;
  useEffect(() => {
    if (parsed.error || repaired.current.has(source)) {
      return;
    }
    try {
      const next = repairSetup(source);
      if (next !== source) {
        repaired.current.add(source);
        editSource?.(next);
      }
    } catch (caught) {
      setError(String(caught));
    }
  }, [source, parsed.error, editSource]);
  const [quickRequest, setQuickRequest] = useState(0);
  const treeTrigger = useRef<HTMLButtonElement>(null),
    inspectorTrigger = useRef<HTMLButtonElement>(null);
  const treePane = useRef<HTMLElement>(null),
    inspectorPane = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      !sheet ||
      !window.matchMedia?.(`(max-width: ${theme.studio.breakpoint})`)?.matches
    ) {
      return;
    }
    (sheet === 'tree' ? treePane : inspectorPane).current
      ?.querySelector<HTMLButtonElement>('.close-pane')
      ?.focus();
  }, [sheet]);
  const cad = context?.setCadActive;
  useEffect(() => {
    cad?.(true);
    return () => cad?.(false);
  }, [cad]);
  const analysis = useCaseAnalysis(
    source,
    context?.injectionInput,
    assets,
    stage !== 'case'
  );
  const layout = useLayoutAnalysis(
    source,
    context?.injectionInput,
    stage !== 'case'
  );
  const report = layout.result?.layout;
  const stale =
    layout.stale || layout.pending || !!layout.error || !!parsed.error;
  const boardStale =
    analysis.stale || analysis.pending || !!analysis.error || !!parsed.error;
  const edit = (
    transform: (before: string) => string,
    finish: (source: string) => void = (next) => context?.editSource(next)
  ) => {
    try {
      const before = context?.getRealtimeConfigInput() || '';
      const next = transform(before);
      finish(next);
      setError('');
    } catch (caught) {
      if (caught instanceof ResizeReview) {
        setResizeReview({ proposal: caught.proposal, finish });
        return;
      }
      setError(String(caught));
    }
  };
  const choose = (
    value: StudioSelection,
    panel: 'inspect' | 'keep' = 'inspect'
  ) => {
    setSelection(value);
    setReview(false);
    if (panel === 'inspect') {
      setSheet('inspector');
    }
  };
  const move = (target: StudioSelection, delta: number[], before: string) => {
    if (before !== context?.getRealtimeConfigInput()) {
      setError('The source changed during this move. Retry.');
      return;
    }
    if (target.section === 'columns') {
      const cluster = target.cluster || '',
        frame = report?.clusters[cluster];
      if (!frame || frame.locked || stale) {
        return;
      }
      edit((current) =>
        moveColumn(current, cluster, target.id, delta, frame.matrix)
      );
      return;
    }
    if (target.section !== 'objects' && target.section !== 'clusters') {
      return;
    }
    const frame = report?.[target.section]?.[target.id];
    if (!frame || frame.locked || stale) {
      return;
    }
    edit((current) =>
      moveLayout(
        current,
        target.section as 'objects' | 'clusters',
        target.id,
        delta,
        frame.editMatrix
      )
    );
  };
  const changeStage = (next: Stage) => {
    setStage(next);
    setLibrary(false);
    setSketch(false);
    setCode(false);
    setSheet('');
    setReview(false);
    if (next === 'pcb') {
      choose({
        section: 'outline',
        id: Object.keys(data.designs?.profiles || {})[0] || '',
      });
    }
  };
  const add = () => {
    const id =
      newName.trim() ||
      nextId(
        [
          ...Object.keys(data.layout.objects || {}),
          ...Object.keys(data.layout.clusters || {}),
          ...Object.keys(data.layout.layers || {}),
          ...Object.keys(data.layout.constraints || {}),
        ],
        newKind
      );
    let section: StudioSelection['section'] = 'objects';
    try {
      let next = source;
      if (['columns', 'arc', 'free'].includes(newKind)) {
        section = 'clusters';
        next = addCluster(
          source,
          id,
          newKind as 'columns' | 'arc' | 'free',
          matrixSize
        );
      } else if (newKind === 'mirror') {
        section = 'clusters';
        const original =
          selection.section === 'clusters' &&
          data.layout.clusters?.[selection.id]
            ? selection.id
            : Object.keys(data.layout.clusters || {}).find(
                (key) => !data.layout.clusters![key].mirror
              );
        if (!original) {
          throw new Error('Create or select a source cluster first.');
        }
        next = setValue(source, ['layout', 'clusters', id], {
          label: id,
          mirror: { source: original, axis: 100 },
        });
      } else if (newKind === 'constraint') {
        section = 'constraints';
        const refs = Object.keys(data.layout.objects || {});
        if (refs.length < 2) {
          throw new Error('Add two objects before creating a constraint.');
        }
        const first =
          selection.section === 'objects' && refs.includes(selection.id)
            ? selection.id
            : refs[0];
        const second = refs.find((ref) => ref !== first)!;
        const a = report?.objects[first],
          b = report?.objects[second];
        const value =
          a && b
            ? Number(
                Math.hypot(
                  a.position[0] - b.position[0],
                  a.position[1] - b.position[1]
                ).toFixed(3)
              )
            : 19;
        next = setValue(source, ['layout', 'constraints', id], {
          type: 'distance',
          refs: [first, second],
          value,
        });
      } else if (newKind === 'layer') {
        section = 'layers';
        next = setValue(source, ['layout', 'layers', id], { surface: 'world' });
      } else {
        next = addObject(
          source,
          id,
          newKind as 'key' | 'component',
          selection.section === 'clusters' &&
            data.layout.clusters?.[selection.id]?.arrangement?.type === 'free'
            ? selection.id
            : undefined
        );
      }
      if (
        (section === 'clusters' && newKind !== 'mirror') ||
        section === 'objects'
      ) {
        next = placeNewItem(
          next,
          section as 'objects' | 'clusters',
          id,
          report
        );
      }
      context?.editSource(next);
      choose({ section, id });
      setNewName('');
      setAdding(false);
      setSheet('inspector');
      setError('');
    } catch (caught) {
      setError(String(caught));
    }
  };
  const selectedProfile =
    data.pcbs?.[Object.keys(data.pcbs || {})[0]]?.profile ||
    `profiles.${Object.keys(data.designs?.profiles || {})[0]}`;
  const model = boardStale
    ? undefined
    : analysis.result?.designs?.features[selectedProfile]?.model;
  const pcb = Object.entries(analysis.result?.pcbs || {})[0];
  const savedSetup = (
    parsed.error ? undefined : getValue(source, ['meta', 'studio', 'setup'])
  ) as DesignSetup | undefined;
  const setupIssues = ((!parsed.error &&
    getValue(source, ['meta', 'studio', 'findings'])) ||
    []) as string[];
  const electricalIssues = ((!parsed.error &&
    getValue(source, ['meta', 'studio', 'electricalFindings'])) ||
    []) as string[];
  const findings = [
    ...[...setupIssues, ...electricalIssues].map((message) => ({
      feature: 'meta.studio.setup',
      sourcePath: 'meta.studio.setup',
      code: 'setup-incomplete',
      severity: 'error',
      message,
    })),
    ...(report?.findings || []),
    ...(layout.diagnostics || []),
    ...analysis.diagnostics,
  ];
  const uniqueFindings = Array.from(
    new Map(
      findings.map((finding) => [
        `${finding.feature}:${finding.code}:${finding.message}`,
        finding,
      ])
    ).values()
  );
  const blockers = uniqueFindings.filter(
    (item) => item.severity === 'error'
  ).length;
  const solver =
    report && 'constraints' in report
      ? (report.constraints as { status: string; dof: number })
      : undefined;
  const navigateFinding = (path: string) => {
    const chunks = path.split('.');
    if (
      chunks[0] === 'layout' &&
      ['objects', 'clusters', 'constraints', 'layers'].includes(chunks[1])
    ) {
      setSelection({
        section: chunks[1] as StudioSelection['section'],
        id: chunks[2],
      });
      setStage('layout');
    } else if (chunks[0] === 'units') {
      setSelection({ section: 'parameters', id: '' });
    } else {
      setStage('case');
    }
    setReview(false);
    setSheet('inspector');
  };
  const closeSheet = () => {
    const trigger = sheet === 'tree' ? treeTrigger : inspectorTrigger;
    setSheet('');
    trigger.current?.focus();
  };
  if (!context) {
    return null;
  }
  return (
    <StudioShell
      aria-label="Board Studio"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setAdding(false);
          setLibrary(false);
          setReview(false);
          closeSheet();
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 'z' &&
          !(event.target as Element).closest('.monaco-editor')
        ) {
          event.preventDefault();
          if (event.shiftKey) {
            context.redo();
          } else {
            context.undo();
          }
        }
      }}
    >
      {resizeReview && (
        <ResizeReviewDialog
          proposal={resizeReview.proposal}
          onCancel={() => setResizeReview(null)}
          onApply={() => {
            if (
              context.getRealtimeConfigInput() !== resizeReview.proposal.before
            ) {
              setError(
                'The project changed during review. Resize again to review the current keys.'
              );
              setResizeReview(null);
              return;
            }
            try {
              resizeReview.finish(resizeReview.proposal.after);
              setResizeReview(null);
              setError('');
            } catch (caught) {
              setError(String(caught));
            }
          }}
        />
      )}
      {setupOpen && (
        <NewDesignWorkspace
          initial={
            (assemblyKeys.length
              ? keySetup(source, assemblyKeys[0])
              : savedSetup) || defaultSetup()
          }
          mode={assemblyKeys.length ? 'assembly' : 'design'}
          onCancel={() => setSetupOpen(false)}
          onCreate={(next, newAssets, injections) => {
            const setup = getValue(next, [
              'meta',
              'studio',
              'setup',
            ]) as DesignSetup;
            edit(
              (before) =>
                assemblyKeys.length
                  ? applyAssembly(
                      before,
                      assemblyKeys,
                      setup,
                      'preserve',
                      selection?.section === 'clusters'
                        ? 'cluster'
                        : selection?.section === 'columns'
                          ? 'column'
                          : 'keys'
                    )
                  : updateSetup(before, setup),
              (after) => {
                context.commitProject(
                  { source: after },
                  { assets: newAssets, injections }
                );
                setSetupOpen(false);
              }
            );
          }}
        />
      )}
      <StudioHeader>
        <button
          aria-label="Projects"
          onClick={() => context.setShowSideNav(true)}
        >
          <FolderOpen size={20} />
        </button>
        <h1>
          <span className="desktop">Board Studio / </span>
          {context.activeConfigName}
        </h1>
        <small className="desktop">
          {context.error ? 'Needs attention' : 'Autosaved'}
        </small>
        {onUpdate && <UpdateChip onClick={onUpdate} />}
        {onInstall && <InstallChip onClick={onInstall} />}
        <div className="project-actions">
          <button
            aria-label="Undo project edit"
            disabled={!context.canUndo}
            onClick={context.undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            aria-label="Redo project edit"
            disabled={!context.canRedo}
            onClick={context.redo}
          >
            <Redo2 size={18} />
          </button>
          <button
            aria-label="Code"
            aria-pressed={code}
            onClick={() => {
              setCode(!code);
              setLibrary(false);
            }}
          >
            <Code2 size={18} />
            <span className="desktop">Code</span>
            <span
              className="sr-only"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
              }}
            >
              Code
            </span>
          </button>
          {!parsed.error && selectedKeys(source, selection).length > 0 && (
            <button
              onClick={() => {
                setAssemblyKeys(selectedKeys(source, selection));
                setSetupOpen(true);
              }}
            >
              Edit key assembly
            </button>
          )}
          {savedSetup && (
            <button
              onClick={() => {
                setAssemblyKeys([]);
                setSetupOpen(true);
              }}
            >
              Design setup
            </button>
          )}
          <button
            data-primary="true"
            aria-label="Generate project"
            disabled={!!parsed.error || context.isGenerating || stale}
            onClick={() =>
              context.generateNow(source, context.injectionInput, {
                pointsonly: false,
              })
            }
          >
            <Box size={18} />
            <span className="desktop">Generate 3D</span>
          </button>
        </div>
        <button
          aria-label="Settings"
          onClick={() => context.setShowSettings(true)}
        >
          <Settings size={18} />
        </button>
      </StudioHeader>
      <StageNav aria-label="Design workflow">
        {stages.map(([id, label, Glyph]) => (
          <button
            key={id}
            aria-current={stage === id ? 'step' : undefined}
            onClick={() => changeStage(id)}
          >
            <Glyph size={20} />
            {label}
          </button>
        ))}
      </StageNav>
      {context.error && (
        <StudioStatus role="alert">{context.error}</StudioStatus>
      )}
      {(error || parsed.error) && (
        <StudioStatus role="alert">
          {error || parsed.error}
          <button
            onClick={() => {
              setError('');
              setCode(true);
            }}
          >
            Open Code
          </button>
        </StudioStatus>
      )}
      {code ? (
        <StudioMain style={{ flex: 1 }}>
          <ConfigEditor aria-label="Project YAML" className="studio-code" />
        </StudioMain>
      ) : library ? (
        <Suspense fallback={<p>Opening part library…</p>}>
          <StudioBar>
            <h2>Part library</h2>
            <button onClick={() => setLibrary(false)}>Back to design</button>
          </StudioBar>
          <FootprintLibrary
            source={source}
            onSource={(next) => edit(() => next)}
            onPreview={() => changeStage('case')}
          />
        </Suspense>
      ) : stage === 'case' && !parsed.error ? (
        <CaseWizard
          presentation="embedded"
          onClose={() => changeStage('layout')}
        />
      ) : stage === 'export' ? (
        <StudioExport
          source={source}
          injections={context.injectionInput}
          assets={assets}
          result={analysis.result}
          stale={boardStale}
          blockers={blockers}
          review={() => changeStage('case')}
        />
      ) : (
        <>
          <StudioBar
            className={
              stage === 'layout' ? 'studio-mobile-tools' : 'studio-stage-tools'
            }
          >
            <button
              className="mobile-only"
              ref={treeTrigger}
              onClick={() => setSheet(sheet === 'tree' ? '' : 'tree')}
            >
              <ListTree size={18} />
              Objects
            </button>
            <button
              className="mobile-only"
              ref={inspectorTrigger}
              onClick={() => setSheet(sheet === 'inspector' ? '' : 'inspector')}
            >
              <SlidersHorizontal size={18} />
              Inspector
            </button>
            {stage === 'components' && (
              <button onClick={() => setLibrary(true)}>Part library</button>
            )}
            {stage === 'pcb' && (
              <>
                <button
                  aria-pressed={pcbView === 'outline'}
                  onClick={() => setPcbView('outline')}
                >
                  Outline
                </button>
                <button
                  aria-pressed={pcbView === 'pcb'}
                  onClick={() => setPcbView('pcb')}
                >
                  KiCad PCB
                </button>
              </>
            )}
          </StudioBar>
          <StudioBody data-sheet={sheet || undefined}>
            <StudioPane
              ref={treePane}
              $side="left"
              $open={sheet === 'tree'}
              aria-label="Object tree"
            >
              <button className="close-pane" onClick={closeSheet}>
                <X size={18} />
                Close objects
              </button>
              <StudioActions>
                <button
                  onClick={() => {
                    setAdding(!adding);
                    setNewKind(
                      stage === 'components' ? 'component' : 'columns'
                    );
                  }}
                >
                  <Plus size={16} />
                  Add
                </button>
              </StudioActions>
              {adding && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    add();
                  }}
                >
                  <StudioField>
                    <span>Kind</span>
                    <select
                      aria-label="New item kind"
                      value={newKind}
                      onChange={(event) => setNewKind(event.target.value)}
                    >
                      {Object.entries({
                        columns: 'Key matrix',
                        arc: 'Thumb arc',
                        free: 'Free cluster',
                        mirror: 'Linked mirror',
                        key: 'Key',
                        component: 'Component',
                        layer: 'Mounting layer',
                        constraint: 'Constraint',
                      }).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </StudioField>
                  {newKind === 'columns' && (
                    <StudioActions>
                      {(['columns', 'rows'] as const).map((name) => (
                        <StudioField key={name}>
                          <span>{name === 'columns' ? 'Columns' : 'Rows'}</span>
                          <input
                            aria-label={`New matrix ${name}`}
                            type="number"
                            min="1"
                            max="100"
                            value={matrixSize[name]}
                            onChange={(event) =>
                              setMatrixSize({
                                ...matrixSize,
                                [name]: Number(event.target.value),
                              })
                            }
                          />
                        </StudioField>
                      ))}
                    </StudioActions>
                  )}
                  <StudioField>
                    <span>Name</span>
                    <input
                      aria-label="New item name"
                      value={newName}
                      pattern="[A-Za-z_][A-Za-z_0-9-]*"
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </StudioField>
                  <StudioActions>
                    <button
                      type="submit"
                      disabled={
                        Object.keys(data.layout.objects || {}).length > 0 &&
                        !Object.keys(report?.objects || {}).length
                      }
                    >
                      Create
                    </button>
                    <button type="button" onClick={() => setAdding(false)}>
                      Cancel
                    </button>
                  </StudioActions>
                </form>
              )}
              <LayoutDefaults source={source} edit={edit} />
              <ClusterTree
                data={data}
                report={report}
                selection={selection}
                choose={choose}
              />
              <details open={stage === 'components'}>
                <summary>Components and free objects</summary>
                {Object.entries(data.layout.objects || {})
                  .filter(([, item]) => !item.cluster)
                  .map(([id, item]) => (
                    <TreeButton
                      key={id}
                      aria-pressed={
                        selection.section === 'objects' && selection.id === id
                      }
                      onClick={() => choose({ section: 'objects', id })}
                    >
                      <Component size={18} />
                      <span>
                        {item.label || id}
                        <small>{item.kind}</small>
                      </span>
                    </TreeButton>
                  ))}
              </details>
              <h3>Design</h3>
              <TreeButton
                aria-pressed={selection.section === 'parameters'}
                onClick={() => choose({ section: 'parameters', id: '' })}
              >
                <Variable size={18} />
                Parameters
              </TreeButton>
              <TreeButton
                aria-pressed={selection.section === 'constraints'}
                onClick={() =>
                  choose({
                    section: 'constraints',
                    id: Object.keys(data.layout.constraints || {})[0] || '',
                  })
                }
              >
                <GitBranch size={18} />
                Constraints
              </TreeButton>
              {Object.entries(data.layout.constraints || {}).map(
                ([id, item]) => (
                  <TreeButton
                    key={id}
                    aria-pressed={
                      selection.section === 'constraints' && selection.id === id
                    }
                    onClick={() => choose({ section: 'constraints', id })}
                  >
                    {item.label || id}
                  </TreeButton>
                )
              )}
              <details>
                <summary>Mounting layers</summary>
                {Object.keys(data.layout.layers || {}).map((id) => (
                  <TreeButton
                    key={id}
                    aria-pressed={
                      selection.section === 'layers' && selection.id === id
                    }
                    onClick={() => choose({ section: 'layers', id })}
                  >
                    {id}
                    <small>Layer</small>
                  </TreeButton>
                ))}
              </details>
              {Object.keys(data.designs?.profiles || {}).map((id) => (
                <TreeButton
                  key={id}
                  aria-pressed={
                    selection.section === 'outline' && selection.id === id
                  }
                  onClick={() => choose({ section: 'outline', id })}
                >
                  {id}
                  <small>Outline</small>
                </TreeButton>
              ))}
              <button
                onClick={() =>
                  edit((before) =>
                    addOutline(
                      before,
                      Object.keys(data.pcbs || {})[0] || 'main',
                      report,
                      'replace'
                    )
                  )
                }
              >
                Rebuild board outline
              </button>
              <StudioActions>
                <button
                  onClick={() => {
                    setSketch(!sketch);
                    setSheet('');
                  }}
                >
                  Sketches
                </button>
                <button onClick={() => setLibrary(true)}>Part library</button>
              </StudioActions>
            </StudioPane>
            <StudioMain>
              {!stale && analysis.error && (
                <StudioStatus role="status">
                  Layout is editable. Board outline needs attention:{' '}
                  {analysis.error}
                </StudioStatus>
              )}
              {stale && (
                <StudioStatus role="status">
                  {layout.pending
                    ? 'Updating layout…'
                    : 'Showing the last valid geometry.'}
                  {layout.error && (
                    <button onClick={layout.generate}>Retry analysis</button>
                  )}
                </StudioStatus>
              )}
              {sketch ? (
                <Suspense fallback={<p>Opening sketches…</p>}>
                  <DesignView />
                </Suspense>
              ) : stage === 'pcb' && pcbView === 'pcb' ? (
                pcb ? (
                  <FilePreview
                    previewKey={`pcbs.${pcb[0]}`}
                    previewExtension="kicad_pcb"
                    previewContent={pcb[1]}
                  />
                ) : (
                  <p>Generate a PCB profile to inspect its footprints.</p>
                )
              ) : (
                <>
                  <SelectionPopover
                    source={source}
                    selection={selection}
                    report={report}
                    edit={edit}
                    request={quickRequest}
                  />
                  <StudioCanvas
                    report={report}
                    injections={context.injectionInput}
                    source={source}
                    stale={stale}
                    selection={selection}
                    onSelect={choose}
                    onQuickEdit={(value) => {
                      choose(value, 'keep');
                      setQuickRequest((current) => current + 1);
                    }}
                    onMove={move}
                    model={model}
                    side={side}
                    onSide={setSide}
                    rules={data.layout.constraints || {}}
                  />
                </>
              )}
            </StudioMain>
            <StudioPane
              ref={inspectorPane}
              $side="right"
              $open={sheet === 'inspector'}
              aria-label="Design inspector"
            >
              <button className="close-pane" onClick={closeSheet}>
                <X size={18} />
                Close inspector
              </button>
              <StudioInspector
                source={source}
                data={data}
                selection={selection}
                report={report}
                edit={edit}
                select={choose}
              />
            </StudioPane>
          </StudioBody>
        </>
      )}
      {review && (
        <StudioStatus
          role="region"
          aria-label="Project findings"
          style={{ maxHeight: '35vh', overflow: 'auto', alignItems: 'start' }}
        >
          {(layout.error || analysis.error) && (
            <p role="alert">{layout.error || analysis.error}</p>
          )}
          {!uniqueFindings.length && <p>No current layout findings.</p>}
          {uniqueFindings.map((issue, index) => (
            <button
              key={index}
              onClick={() =>
                navigateFinding(
                  ('sourcePath' in issue && issue.sourcePath) || issue.feature
                )
              }
            >
              {issue.severity}: {issue.message}
            </button>
          ))}
          <button onClick={() => setReview(false)}>Close findings</button>
        </StudioStatus>
      )}
      <StudioStatus role="status">
        <small>
          {stale
            ? 'Layout needs analysis'
            : solver
              ? `Layout ${solver.status === 'solved' ? 'solved' : `solved · ${solver.dof} free movements`}`
              : 'Layout resolved'}{' '}
          ·{' '}
          {
            Object.values(report?.objects || {}).filter(
              (item) => item.kind === 'key'
            ).length
          }{' '}
          keys
        </small>
        <button onClick={() => setReview(!review)}>
          {blockers
            ? `${blockers} blockers`
            : analysis.error
              ? 'Analysis needs attention'
              : `${uniqueFindings.length} checks`}
        </button>
      </StudioStatus>
    </StudioShell>
  );
}
