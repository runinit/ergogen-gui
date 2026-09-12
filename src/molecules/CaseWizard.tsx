import NativeCaseObjects from './NativeCaseObjects';
import { editNativeBoard } from '../utils/nativeBoardSource';
import CaseModelInset from './CaseModelInset';
import { previewModels } from '../utils/modelPreview';
import { libraryAssets } from '../utils/footprintLibrary';
import { useFootprintLibrary } from '../hooks/useFootprintLibrary';
import { lazy, Suspense } from 'react';
import AssemblyTree from './AssemblyTree';
import {
  assemblyNodes,
  AssemblyNode,
  findTreeNode,
  treeParts,
} from '../utils/assemblyTree';
const FootprintLibrary = lazy(() => import('./FootprintLibrary'));
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDocument } from 'yaml';
import makerjs from 'makerjs';
import styled from 'styled-components';
import { useConfigContext } from '../context/ConfigContext';
import {
  useCasePreview,
  useCaseAnalysis,
  type GeometryJob,
} from '../hooks/useCasePreview';
import {
  CASE_STEPS,
  batchCaseEdit,
  caseNames,
  createCase,
  editCase,
  editCaseChanges,
  MOUNT_STYLES,
  removeCaseField,
  toggleDesignRef,
} from '../utils/enclosureSource';
import { applyDesignEdit, editDesign, SourcePath } from '../utils/designSource';
import { createZip } from '../utils/zip';
import { theme } from '../theme/theme';
import AssemblyPreview from './AssemblyPreview';
import Field, { CaseHelp } from './CaseField';
import CasePlanPreview, {
  ProfilePreview,
  StackDiagram,
} from './CasePlanPreview';
import { loadAssets, saveAssets } from '../utils/caseAssets';
import CaseComponents from './CaseComponents';
import CaseReview from './CaseReview';
import CaseControlHelp from './CaseControlHelp';
import { CaseConfig, CasePlacement } from '../types/case';
import {
  applyPreset,
  JLC_GUIDE,
  JLC_PRESET,
  PLATE_CNC_DEFAULTS,
} from '../utils/casePresets';

const FINDING_STEPS: [RegExp, string][] = [
  [
    /^(board\.(components|models|keycaps)|components|openings)(\.|$)/,
    'Components',
  ],
  [/^(mounts|board\.holes)(\.|$)/, 'Hardware'],
  [
    /^(gasket|gaskets|mount_count|mounting|spacing|pcb|pcb_z|pcb_thickness|plate_z)(\.|$)/,
    'Mounting',
  ],
  [/^manufacturing(\.|$)/, 'Manufacturing'],
  [
    /^(seam|floor|height|wall|bezel|fit|construction|top|bottom|middle|plate)(\.|$)/,
    'Enclosure',
  ],
];

const Shell = styled.section<{ $embedded?: boolean }>`
  position: ${(p) => (p.$embedded ? 'relative' : 'fixed')};
  min-height: 0;
  flex: 1;
  overflow: hidden;
  inset: 0;
  z-index: ${(p) => (p.$embedded ? 'auto' : theme.caseWizard.overlay)};
  background: ${theme.colors.background};
  color: ${theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${theme.fonts.body};
  button,
  input,
  select {
    font: inherit;
    color: inherit;
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.cad.fieldRadius};
    background: ${theme.workbench.fieldSurface};
    padding: ${theme.buttonSizes.small.padding};
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button[aria-current='step'] {
    background: ${theme.colors.accentDark};
  }
  input,
  select {
    min-width: 0;
    box-sizing: border-box;
    width: 100%;
  }
  input[type='checkbox'] {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
  }
  h1,
  h2,
  h3,
  p {
    margin-top: 0;
  }
`;
const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.caseWizard.gap};
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.border};
  > div {
    min-width: 0;
  }
  h1 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
    font-size: ${theme.fontSizes.h3};
  }
  p {
    margin: 0;
    color: ${theme.colors.textDarker};
  }
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    flex-wrap: wrap;
    padding: ${theme.spacing.sm};
    gap: ${theme.spacing.sm};
    > div {
      flex: 1;
    }
    p {
      display: none;
    }
    nav {
      order: 1;
      width: 100%;
    }
  }
`;
const Steps = styled.nav`
  flex-direction: column;
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.caseWizard.gap};
  padding: ${theme.caseWizard.gap};
`;
const TreePanel = styled.aside<{ $open: boolean }>`
  overflow: auto;
  padding: ${theme.spacing.md};
  border-right: 1px solid ${theme.colors.border};
  h2 {
    font-size: ${theme.fontSizes.lg};
  }
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    display: ${({ $open }) => ($open ? 'block' : 'none')};
    position: absolute;
    inset: 0 auto 0 0;
    width: min(85vw, ${theme.cad.treeWidth});
    z-index: ${theme.cad.drawerLayer};
    background: ${theme.colors.background};
  }
`;
const WorkspaceTabs = styled.nav`
  display: flex;
  gap: ${theme.spacing.sm};
  button[aria-selected='true'] {
    border-bottom: 3px solid ${theme.colors.accent};
    background: ${theme.colors.backgroundLighter};
  }
`;
const DrawerButtons = styled.div`
  display: none;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    display: flex;
    gap: ${theme.spacing.sm};
  }
`;
const DrawerClose = styled.button`
  display: none;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    display: block;
    margin-bottom: ${theme.spacing.sm};
  }
`;
const LibraryPane = styled.div<{ $active: boolean }>`
  display: ${({ $active }) => ($active ? 'contents' : 'none')};
`;
const YamlPane = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: ${theme.spacing.md};
  textarea {
    flex: 1;
    color: ${theme.colors.text};
    background: ${theme.colors.backgroundLight};
    font-family: ${theme.fonts.code};
  }
`;
const Body = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: ${theme.cad.treeWidth} minmax(0, 1fr) ${theme.cad
      .inspectorWidth};
  overflow: hidden;
  flex: 1;
  min-height: 0;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    grid-template-columns: 1fr;
  }
`;
const Form = styled.div<{ $open?: boolean }>`
  box-sizing: border-box;
  min-width: 0;
  grid-column: 3;
  grid-row: 1;
  border-left: 1px solid ${theme.colors.border};
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    display: ${({ $open }) => ($open ? 'block' : 'none')};
    position: absolute;
    inset: 0 0 0 auto;
    width: min(90vw, ${theme.cad.inspectorWidth});
    z-index: ${theme.cad.drawerLayer};
    background: ${theme.colors.background};
  }
  padding: ${theme.caseWizard.padding};
  overflow: auto;
  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: ${theme.caseWizard.gap};
  }
  label:has(input[type='checkbox']) {
    flex-direction: row;
    align-items: flex-start;
  }
  fieldset {
    min-width: 0;
    margin: ${theme.spacing.sm} 0;
    padding: ${theme.spacing.sm};
    border: 1px solid ${theme.colors.border};
  }
  p,
  small {
    color: ${theme.colors.textDarker};
    line-height: 1.5;
  }
`;
const Card = styled.fieldset`
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.caseWizard.radius};
  padding: ${theme.caseWizard.gap};
  margin: 0 0 ${theme.caseWizard.gap};
  min-width: 0;
  legend {
    padding: 0 0.5rem;
  }
`;
const Preview = styled.div`
  grid-column: 2;
  grid-row: 1;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    grid-column: 1;
  }
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: ${theme.caseWizard.gap};
  background: ${theme.colors.backgroundLight};
  min-height: 0;
  overflow: auto;
`;
const View = styled.div`
  position: relative;
  flex: 1;
  min-height: ${theme.caseWizard.solidHeight};
`;
const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.caseWizard.gap};
  margin-bottom: ${theme.caseWizard.gap};
  select {
    width: auto;
    flex: 1;
  }
`;
const Motion = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.caseWizard.gap};
  label {
    min-width: 0;
  }
`;
const Status = styled.p`
  padding: ${theme.caseWizard.gap};
  color: ${theme.colors.warning};
`;
const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.caseWizard.gap};
  padding: ${theme.caseWizard.gap};
  border-top: 1px solid ${theme.colors.border};
`;

const PROCESS_DEFAULTS = {
  cnc: {
    cutter: 3,
    reach: 25,
    min_wall: 2,
    setups: ['top', 'bottom'],
    stock: [300, 300, 30],
  },
  fdm: {
    nozzle: 0.4,
    layer: 0.2,
    min_wall: 1.2,
    orientation: 'interior-up',
    supports: 'allowed',
    build: [220, 220, 250],
  },
};

type Props = {
  onClose: () => void;
  initialView?: 'case' | 'library' | 'yaml';
  presentation?: 'embedded' | 'dialog';
  session?: {
    preview: GeometryJob;
    analysis: GeometryJob;
    onExport: () => void;
  };
};
export default function CaseWizard({
  onClose,
  initialView,
  presentation,
  session,
}: Props) {
  const context = useConfigContext();
  const source = context?.configInput || '';
  const initialError = useMemo(() => {
    try {
      const doc = parseDocument(source);
      if (doc.errors.length) {
        throw new Error(doc.errors[0].message);
      }
      if (!caseNames(source).length) {
        createCase(source, 'case');
      }
      return '';
    } catch (caught) {
      return `Repair the source YAML before opening the case designer: ${String(caught)}`;
    }
  }, [source]);
  if (initialError) {
    return (
      <Shell role="dialog" aria-modal="true" aria-label="Case designer">
        <Status role="alert">{initialError}</Status>
        <button onClick={onClose}>Cancel</button>
      </Shell>
    );
  }
  if (presentation === 'embedded' && !caseNames(source).length) {
    return (
      <Shell $embedded role="region" aria-label="Case designer">
        <Form>
          <h2>Add a case</h2>
          <p>Create an enclosure when the board layout is ready.</p>
          <button
            onClick={() =>
              context?.editSource(
                createCase(context.getRealtimeConfigInput() || source, 'case')
              )
            }
          >
            Create case
          </button>
        </Form>
      </Shell>
    );
  }
  return (
    <CaseDraft
      onClose={onClose}
      initialView={initialView}
      presentation={presentation}
      session={session}
    />
  );
}

function CaseDraft({ onClose, initialView, presentation, session }: Props) {
  const context = useConfigContext();
  const embedded = presentation === 'embedded';
  const treeButton = useRef<HTMLButtonElement>(null);
  const inspectorButton = useRef<HTMLButtonElement>(null);
  const setCadActive = context?.setCadActive;
  useEffect(() => {
    if (embedded) {
      return;
    }
    setCadActive?.(true);
    return () => setCadActive?.(false);
  }, [setCadActive, embedded]);
  const base = useRef(context?.getRealtimeConfigInput() || '');
  const [name, setName] = useState(() => caseNames(base.current)[0] || 'case');
  const [localDraft, setDraft] = useState(() =>
    caseNames(base.current).length
      ? base.current
      : createCase(base.current, 'case')
  );
  const draft = embedded ? context?.configInput || localDraft : localDraft;
  const liveDraft = useRef(draft);
  liveDraft.current = draft;
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState<'case' | 'library' | 'yaml'>(
    initialView || 'case'
  );
  const [libraryOpened, setLibraryOpened] = useState(initialView === 'library');
  const [treeOpen, setTreeOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [yamlDraft, setYamlDraft] = useState(draft);
  const [treeSelection, setTreeSelection] = useState('');
  const [localAssets, setLocalAssets] = useState<Record<string, string>>({});
  const setAssets =
    embedded && context?.setProjectAssets
      ? context.setProjectAssets
      : setLocalAssets;
  const { entries } = useFootprintLibrary();
  const assets = useMemo(
    () => ({
      ...libraryAssets(context?.injectionInput, entries),
      ...(embedded ? context?.projectAssets : localAssets),
    }),
    [
      context?.injectionInput,
      context?.projectAssets,
      embedded,
      entries,
      localAssets,
    ]
  );
  const [automatic, setAutomatic] = useState('');
  const history = useRef<string[]>([]);
  useEffect(() => {
    if (embedded) {
      return;
    }
    let live = true;
    loadAssets()
      .then((value) => {
        if (live) {
          setLocalAssets(value);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [embedded]);
  const [error, setError] = useState('');
  const [view, setView] = useState('plan');
  const [selected, setSelected] = useState('');
  const [activeModel, setActiveModel] = useState(0);
  const [feature, setFeature] = useState('');
  const [travel, setTravel] = useState(0);
  const [lateral, setLateral] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [nextName, setNextName] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const doc = useMemo(() => parseDocument(draft), [draft]);
  const data = useMemo(() => doc.toJS(), [doc]);
  const spec = useMemo(
    () => data?.designs?.assemblies?.[name] || {},
    [data, name]
  );
  // Standalone drafts own their jobs; embedded views use the persistent project jobs.
  const localPreview = useCasePreview(draft, context?.injectionInput, assets);
  const localAnalysis = useCaseAnalysis(
    draft,
    context?.injectionInput,
    assets,
    !session
  );
  const preview = session?.preview || localPreview;
  const analysis = session?.analysis || localAnalysis;
  const plan = analysis.result?.designs?.analysis?.[name];
  const board = analysis.result?.designs?.boards?.[name];
  const assembly = preview.result?.designs?.assemblies[name];
  const tree = useMemo(
    () => assemblyNodes(name, spec, board, analysis.result?.layout),
    [name, spec, board, analysis.result?.layout]
  );
  const chooseNode = (node: AssemblyNode) => {
    setActiveModel(0);
    setTreeSelection(node.id);
    setSelected(node.id);
    setStep(node.tool);
    setFeature(
      node.feature ||
        (node.component ? `board.components.${node.component}` : '')
    );
    setInspectorOpen(true);
    setTreeOpen(false);
  };
  const choosePart = (id: string) => {
    const node = findTreeNode(tree, id);
    if (node) {
      chooseNode(node);
    } else {
      setSelected(id);
    }
  };
  const transformed = useMemo(() => {
    if (!preview.result) {
      return { result: null, error: '' };
    }
    try {
      return {
        result: previewModels(
          preview.result,
          name,
          spec.board?.models || {},
          assets
        ),
        error: '',
      };
    } catch (error) {
      return { result: preview.result, error: String(error) };
    }
  }, [preview.result, name, spec.board?.models, assets]);
  const previewCases = useMemo(
    () => ({ ...transformed.result?.cases, ...transformed.result?.solids }),
    [transformed.result]
  );
  const selectedParts = useMemo(
    () => treeParts(tree, selected),
    [tree, selected]
  );
  const findings = [
    ...(plan?.findings || []),
    ...(assembly?.manufacturing || []),
    ...preview.diagnostics,
  ];
  const movement = (plan?.parameters?.gasket || spec.gasket || {}) as Record<
    string,
    number
  >;
  const points = Object.entries(data.layout?.objects || {})
    .filter(([, item]) => (item as { kind: string }).kind === 'key')
    .map(([id]) => id);
  const features = analysis.result?.designs?.features || {};
  // Keep declared references available when native generation cannot complete.
  const refs = Array.from(
    new Set([
      ...Object.keys(features).filter((ref) => !ref.startsWith('assemblies.')),
      ...[
        'regions',
        'boundaries',
        'sketches',
        'profiles',
        'components',
      ].flatMap((section) =>
        Object.keys(data?.designs?.[section] || {}).map(
          (id) => `${section}.${id}`
        )
      ),
    ])
  );
  const disconnected = /Expected one connected region/.test(preview.error);
  const staleSource =
    !embedded && base.current !== (context?.getRealtimeConfigInput() || '');
  const processes = [
    'bottom',
    'top',
    'plate',
    ...(spec.construction === 'midframe' ? ['middle'] : []),
  ].every((part) => spec.manufacturing?.[part]?.process);
  const blocked =
    preview.pending ||
    preview.stale ||
    analysis.stale ||
    !!preview.error ||
    !!error ||
    staleSource ||
    !assembly ||
    !processes ||
    findings.some((issue) => issue.severity === 'error');

  useEffect(() => {
    dialog.current?.focus();
  }, []);
  useEffect(() => {
    if (feature) {
      document
        .getElementById(`case-feature-${feature}`)
        ?.scrollIntoView?.({ block: 'center' });
    }
  }, [feature, step]);
  const change = (transform: (source: string) => string) => {
    try {
      const previous = embedded
        ? context?.getRealtimeConfigInput() || liveDraft.current
        : liveDraft.current;
      const next = transform(previous);
      const parsed = parseDocument(next);
      if (parsed.errors.length) {
        throw new Error(parsed.errors[0].message);
      }
      if (embedded) {
        context?.editSource(next);
      } else {
        history.current.push(previous);
      }
      liveDraft.current = next;
      setDraft(next);
      setError('');
      setConfirmed(false);
    } catch (caught) {
      setError(String(caught));
    }
  };
  const edit = (path: SourcePath, value: unknown) =>
    change((source) => {
      if (board?.native) {
        const next = editNativeBoard(source, path, value);
        if (next !== null) {
          return next;
        }
      }
      const axis = path.at(-1),
        key = path.at(-2);
      if (
        typeof axis === 'number' &&
        (key === 'stock' || key === 'build') &&
        doc.getIn(['designs', 'assemblies', name, ...path.slice(0, -1)]) ===
          undefined
      ) {
        const vector: unknown[] = [
          ...(key === 'stock'
            ? PROCESS_DEFAULTS.cnc.stock
            : PROCESS_DEFAULTS.fdm.build),
        ];
        vector[axis] = value;
        return editCase(source, name, path.slice(0, -1), vector);
      }
      let result = editCase(source, name, path, value);
      if (['mounts', 'gaskets'].includes(String(path[0])) && path.length > 2) {
        result = editCase(
          result,
          name,
          [path[0], path[1], 'placement', 'owner'],
          'manual'
        );
      }
      return result;
    });
  const field = (
    path: SourcePath,
    label: string,
    fallback?: unknown,
    choices?: string[]
  ) => (
    <Field
      key={path.join('.')}
      label={label}
      value={
        spec.stackup &&
        path.length === 1 &&
        ['plate', 'pcb_thickness', 'plate_z'].includes(String(path[0]))
          ? path[0] === 'plate'
            ? (data.designs.stackups[spec.stackup]?.plate?.thickness ??
              fallback)
            : path[0] === 'pcb_thickness'
              ? (data.pcbs[spec.board.name]?.thickness ?? fallback)
              : `(${spec.pcb_z ?? 6}) + (${data.pcbs[spec.board.name]?.thickness ?? 1.6}) + (${data.designs.stackups[spec.stackup]?.plate?.gap ?? 5.4})`
          : (doc.getIn(['designs', 'assemblies', name, ...path]) ?? fallback)
      }
      choices={choices}
      defaultValue={fallback}
      onChange={(value) => edit(path, value)}
    />
  );
  const globalField = (
    path: SourcePath,
    label: string,
    fallback?: unknown,
    choices?: string[]
  ) => (
    <Field
      key={path.join('.')}
      label={label}
      value={doc.getIn(path) ?? fallback}
      choices={choices}
      defaultValue={fallback}
      onChange={(value) => change((source) => editDesign(source, path, value))}
    />
  );
  const diameter = (path: SourcePath, label: string, fallback: number) => {
    const radius =
      doc.getIn(['designs', 'assemblies', name, ...path]) ?? fallback;
    const value = typeof radius === 'number' ? radius * 2 : `(${radius}) * 2`;
    return (
      <Field
        key={path.join('.')}
        label={label}
        value={value}
        onChange={(next) =>
          edit(path, typeof next === 'number' ? next / 2 : `(${next}) / 2`)
        }
      />
    );
  };
  const selection = (path: SourcePath, label: string, choices: string[]) => {
    const chosen = doc.toJS()?.designs;
    const selectedValue = path.reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      { designs: chosen }
    );
    const value = selectedValue ?? (path.at(-1) === 'ids' ? true : undefined);
    return (
      <Card aria-label={label}>
        <legend>
          {label}
          <CaseHelp label={label} />
        </legend>
        {choices.map((choice) => (
          <label key={choice}>
            <span>
              <input
                type="checkbox"
                checked={
                  Array.isArray(value)
                    ? value.includes(choice)
                    : value === true || value === choice
                }
                onChange={() =>
                  change((source) => {
                    if (value === true) {
                      return editDesign(
                        source,
                        path,
                        choices.filter((item) => item !== choice)
                      );
                    }
                    return toggleDesignRef(source, path, choice);
                  })
                }
              />{' '}
              {choice}
            </span>
          </label>
        ))}
      </Card>
    );
  };
  const local = (
    path: SourcePath,
    labels: [string, string],
    fallback = [0, 0]
  ) => (
    <>
      {field([...path, 0], labels[0], fallback[0])}
      {field([...path, 1], labels[1], fallback[1])}
    </>
  );
  const accept = (
    suggestion: NonNullable<typeof assembly>['suggestions'][number]
  ) => {
    edit(
      [suggestion.kind === 'gasket' ? 'gaskets' : 'mounts', suggestion.id],
      suggestion.definition
    );
  };
  const apply = async () => {
    if (blocked || !confirmed || !context) {
      return;
    }
    try {
      if (base.current !== context.getRealtimeConfigInput()) {
        throw new Error(
          'The source changed. Close and reopen the wizard before applying.'
        );
      }
      await saveAssets(assets);
      applyDesignEdit(base.current, draft);
      if (preview.result) {
        context.adoptGenerated(draft, preview.result, assets);
      }
      onClose();
    } catch (caught) {
      setError(String(caught));
    }
  };
  const chooseMounting = (value: unknown) => {
    change((source) =>
      batchCaseEdit(source, name, (doc, path) => {
        doc.setIn([...path, 'mounting'], value);
        if (value === 'gasket') {
          doc.deleteIn([...path, 'ledge']);
          for (const [id, mount] of Object.entries(spec.mounts || {})) {
            if ((mount as CaseConfig).role !== 'case') {
              doc.deleteIn([...path, 'mounts', id]);
            }
          }
        } else {
          doc.deleteIn([...path, 'gaskets']);
        }
      })
    );
    if (value !== spec.mounting) {
      setAutomatic(String(value));
    }
    setView('plan');
  };
  const chooseCount = (value: unknown) => {
    if (value === '') {
      change((source) => removeCaseField(source, name, ['mount_count']));
    } else if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 200
    ) {
      setError(
        'Enter a whole contact count between 0 and 200, or leave it blank for spacing-based placement.'
      );
      return;
    } else {
      edit(['mount_count'], value);
    }
    setAutomatic(spec.mounting);
  };
  const redistribute = () =>
    change((source) => {
      return batchCaseEdit(source, name, (doc, path) => {
        for (const table of ['mounts', 'gaskets']) {
          for (const [id, definition] of Object.entries(spec[table] || {})) {
            if ((definition as CaseConfig).placement?.owner === 'automatic') {
              doc.deleteIn([...path, table, id]);
            }
          }
        }
        for (const suggestion of plan?.suggestions || []) {
          const table = suggestion.kind === 'gasket' ? 'gaskets' : 'mounts';
          if (
            spec[table]?.[suggestion.id] &&
            spec[table][suggestion.id].placement?.owner !== 'automatic'
          ) {
            continue;
          }
          doc.setIn([...path, table, suggestion.id], suggestion.definition);
        }
      });
    });
  const redistributeRef = useRef(redistribute);
  redistributeRef.current = redistribute;
  useEffect(() => {
    if (
      !automatic ||
      analysis.stale ||
      analysis.pending ||
      !plan ||
      spec.mounting !== automatic ||
      plan.parameters.mounting !== automatic
    ) {
      return;
    }
    setAutomatic('');
    redistributeRef.current();
  }, [automatic, analysis.stale, analysis.pending, plan, spec.mounting]);
  const editPlacement = (item: CasePlacement, definition: CaseConfig) =>
    change((source) => {
      const path = [item.kind === 'gasket' ? 'gaskets' : 'mounts', item.id];
      const next = editCaseChanges(
        source,
        name,
        path,
        item.definition,
        definition
      );
      return editCase(next, name, [...path, 'placement', 'owner'], 'manual');
    });
  const removePlacement = (item: CasePlacement) => {
    change((source) =>
      removeCaseField(source, name, [
        item.kind === 'gasket' ? 'gaskets' : 'mounts',
        item.id,
      ])
    );
    setFeature('');
  };
  const addPlacement = (
    kind: 'mount' | 'gasket',
    position: number[],
    edge: string,
    angle: number
  ) => {
    const table = kind === 'gasket' ? 'gaskets' : 'mounts';
    let id = `${kind}_1`,
      i = 1;
    while (spec[table]?.[id]) {
      id = `${kind}_${++i}`;
    }
    const template =
      plan?.suggestions.find((s) => s.kind === kind)?.definition ||
      (kind === 'gasket'
        ? { size: [10, 6] }
        : {
            role: 'case',
            post: 4,
            hole: 1.25,
            clearance: 1.7,
            head: 3.1,
            head_depth: 3.3,
            depth: 6,
            hardware: 'tapped',
            thread: 'M3x0.5',
            access: 'bottom',
          });
    const offset = Number(
      template.placement?.offset ??
        (kind === 'gasket'
          ? 2.5
          : template.role === 'case'
            ? Number(spec.bezel ?? 8) +
              Number(spec.wall ?? 3) -
              Number(template.post ?? 4)
            : -1)
    );
    const radians = (angle * Math.PI) / 180;
    let normal = [Math.sin(radians), -Math.cos(radians)];
    if (
      plan?.model &&
      makerjs.measure.isPointInsideModel(
        position.map((v, i) => v + normal[i]),
        plan.model
      )
    ) {
      normal = normal.map((v) => -v);
    }
    edit([table, id], {
      ...template,
      anchor: {
        shift: position.map((v, i) => v + normal[i] * offset),
        rotate: angle,
      },
      placement: { owner: 'manual', edge, offset },
    });
    setFeature(`${table}.${id}`);
  };
  const duplicatePlacement = (item: CasePlacement) => {
    const table = item.kind === 'gasket' ? 'gaskets' : 'mounts';
    let id = `${item.id}_copy`;
    while (spec[table]?.[id]) {
      id += '_copy';
    }
    edit([table, id], {
      ...item.definition,
      anchor: {
        shift: [item.position[0] + 5, item.position[1]],
        rotate: item.definition.anchor?.rotate || 0,
      },
      placement: { owner: 'manual' },
    });
    setFeature(`${table}.${id}`);
  };
  const setProcess = (part: string, value: unknown) =>
    change((source) => {
      let result = editCase(
        source,
        name,
        ['manufacturing', part, 'process'],
        value
      );
      const defaults =
        value === 'cnc'
          ? {
              ...PROCESS_DEFAULTS.cnc,
              ...(part === 'plate' ? PLATE_CNC_DEFAULTS : {}),
            }
          : PROCESS_DEFAULTS.fdm;
      for (const [key, next] of Object.entries(defaults)) {
        if (
          parseDocument(result).getIn([
            'designs',
            'assemblies',
            name,
            'manufacturing',
            part,
            key,
          ]) === undefined
        ) {
          result = editCase(result, name, ['manufacturing', part, key], next);
        }
      }
      return result;
    });

  return (
    <Shell
      $embedded={embedded}
      ref={dialog}
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label="Case designer"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (embedded) {
          return;
        }
        if (event.key === 'Escape') {
          if (treeOpen || inspectorOpen) {
            const button = (treeOpen ? treeButton : inspectorButton).current;
            if (button?.getClientRects().length) {
              button.focus();
            }
            setTreeOpen(false);
            setInspectorOpen(false);
            return;
          }
          onClose();
        }
        if (event.key !== 'Tab') {
          return;
        }
        const focusable = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea, a[href]'
          ) || []
        ).filter((element) => element.getClientRects().length);
        if (!focusable?.length) {
          return;
        }
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      {workspace === 'case' && <CaseControlHelp root={dialog} />}
      {!embedded && (
        <Header>
          <div>
            <h1>
              <img
                src={`${import.meta.env.BASE_URL}ergogen.png`}
                alt="Ergogen"
                width="28"
                height="28"
              />{' '}
              {context?.activeConfigName || 'Ergogen'} / Case
            </h1>
            <p>
              Select a part · prepare · inspect · export
              {process.env.REACT_APP_DEPLOYMENT_CHANNEL === 'preview'
                ? ` · Preview ${process.env.REACT_APP_BUILD_REVISION?.slice(0, 7)}`
                : ''}
            </p>
          </div>
          <WorkspaceTabs role="tablist" aria-label="Workspace views">
            <button
              role="tab"
              aria-selected={workspace === 'case'}
              onClick={() => setWorkspace('case')}
            >
              Case
            </button>
            <button
              role="tab"
              aria-selected={workspace === 'library'}
              onClick={() => {
                setLibraryOpened(true);
                setWorkspace('library');
              }}
            >
              Footprint library
            </button>
            <button
              role="tab"
              aria-selected={workspace === 'yaml'}
              onClick={() => {
                setYamlDraft(draft);
                setWorkspace('yaml');
              }}
            >
              YAML
            </button>
          </WorkspaceTabs>
          <button onClick={onClose}>Cancel</button>
        </Header>
      )}
      {libraryOpened && (
        <LibraryPane $active={workspace === 'library'}>
          <Suspense fallback={<Status>Opening footprint library…</Status>}>
            <FootprintLibrary
              source={draft}
              onSource={(next) => change(() => next)}
              onPreview={() => setWorkspace('case')}
            />
          </Suspense>
        </LibraryPane>
      )}
      {workspace === 'yaml' && (
        <YamlPane>
          <label htmlFor="case-source">
            Project YAML · expressions, comments and inheritance are retained
          </label>
          <textarea
            id="case-source"
            value={yamlDraft}
            onChange={(event) => setYamlDraft(event.target.value)}
          />
          <button
            onClick={() => {
              change(() => yamlDraft);
            }}
          >
            Apply YAML edit
          </button>
          {error && <p role="alert">{error}</p>}
        </YamlPane>
      )}
      {workspace === 'case' && (
        <>
          <DrawerButtons>
            <button
              ref={treeButton}
              onClick={() => {
                setTreeOpen(!treeOpen);
                setInspectorOpen(false);
              }}
            >
              Assembly tree
            </button>
            <button
              ref={inspectorButton}
              onClick={() => {
                setInspectorOpen(!inspectorOpen);
                setTreeOpen(false);
              }}
            >
              Inspector
            </button>
          </DrawerButtons>
          {!session && (
            <Controls>
              <button
                onClick={preview.generate}
                disabled={
                  preview.pending ||
                  !!automatic ||
                  analysis.stale ||
                  !!analysis.error ||
                  !spec.mounting
                }
                title="Build and validate the current draft; edits only update the 2D plan."
              >
                {preview.pending ? 'Generating…' : 'Generate'}
              </button>
              {findings.length > 0 && (
                <button onClick={() => setStep(6)}>Review findings</button>
              )}
              {(preview.pending || preview.error) && (
                <button onClick={preview.generate}>
                  Restart worker and retry
                </button>
              )}
              {(analysis.pending || (analysis.stale && !analysis.error)) && (
                <span role="status">Calculating mounting plan…</span>
              )}
              <span role="status">
                {preview.pending
                  ? 'Generating geometry…'
                  : preview.stale
                    ? 'Changes not generated'
                    : 'Generated current draft'}
              </span>
              {!embedded && (
                <button
                  disabled={!history.current.length}
                  onClick={() => {
                    const previous = history.current.pop();
                    if (previous) {
                      setDraft(previous);
                      setConfirmed(false);
                    }
                  }}
                  title="Undo the last draft edit"
                >
                  Undo
                </button>
              )}
            </Controls>
          )}
          <Body>
            <TreePanel $open={treeOpen} aria-label="Assembly panel">
              <DrawerClose
                onClick={() => {
                  setTreeOpen(false);
                  treeButton.current?.focus();
                }}
              >
                Close assembly tree
              </DrawerClose>
              <h2>Assembly</h2>
              <p>{name}</p>
              <AssemblyTree
                nodes={tree}
                selected={treeSelection || selected}
                hidden={hidden}
                onSelect={chooseNode}
                onVisibility={(ids) =>
                  setHidden((previous) =>
                    previous.includes(ids[0])
                      ? previous.filter((id) => !ids.includes(id))
                      : Array.from(new Set([...previous, ...ids]))
                  )
                }
              />
              <details open>
                <summary>Case setup</summary>
                <Steps aria-label="Case tools">
                  {CASE_STEPS.map((label, index) => (
                    <button
                      key={label}
                      aria-current={step === index ? 'step' : undefined}
                      onClick={() => {
                        setStep(index);
                        setInspectorOpen(true);
                        setTreeOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </Steps>
              </details>
            </TreePanel>
            <Form $open={inspectorOpen} aria-label="Contextual inspector">
              <DrawerClose
                onClick={() => {
                  setInspectorOpen(false);
                  inspectorButton.current?.focus();
                }}
              >
                Close inspector
              </DrawerClose>
              <h2>{CASE_STEPS[step]}</h2>
              {step === 0 && (
                <p>
                  Component setup is optional. Use existing board footprints and
                  models, or{' '}
                  <button onClick={() => setStep(4)}>
                    Set up footprints and models
                  </button>
                  . Missing envelopes leave clearance checks incomplete.
                </p>
              )}
              {step === 0 && (
                <>
                  <Field
                    label="Case"
                    value={name}
                    choices={caseNames(draft)}
                    onChange={(value) => setName(String(value))}
                  />
                  <Controls>
                    <input
                      aria-label="New case name"
                      value={nextName}
                      onChange={(event) => setNextName(event.target.value)}
                      placeholder="Name another case"
                    />
                    <button
                      onClick={() => {
                        try {
                          const result = createCase(draft, nextName);
                          setDraft(result);
                          setName(nextName);
                          setNextName('');
                        } catch (caught) {
                          setError(String(caught));
                        }
                      }}
                    >
                      Add case
                    </button>
                  </Controls>
                  <p>
                    Use one assembly per connected case body. Keep split halves
                    separate or add a named bridge.
                  </p>
                  <Field
                    label="Board source"
                    value={
                      spec.board
                        ? `${spec.board.source}:${spec.board.name}`
                        : ''
                    }
                    choices={[
                      '',
                      ...Object.keys(data.pcbs || {}).map(
                        (key) => `generated:${key}`
                      ),
                      ...Object.keys(assets)
                        .filter((key) => key.endsWith('.kicad_pcb'))
                        .map((key) => `asset:${key}`),
                    ]}
                    onChange={(value) => {
                      const [source, ...parts] = String(value).split(':');
                      if (!source) {
                        change((text) =>
                          removeCaseField(text, name, ['board'])
                        );
                        return;
                      }
                      edit(['board'], { source, name: parts.join(':') });
                    }}
                  />
                  <label>
                    Import KiCad PCB
                    <input
                      type="file"
                      accept=".kicad_pcb"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }
                        const text = await file.text();
                        setAssets((previous) => ({
                          ...previous,
                          [file.name]: text,
                        }));
                        edit(['board'], { source: 'asset', name: file.name });
                      }}
                    />
                  </label>
                  <Field
                    label="Mounting system"
                    value={spec.mounting || ''}
                    choices={['', ...MOUNT_STYLES]}
                    onChange={chooseMounting}
                  />
                  {spec.mounting === 'gasket' &&
                    (spec.ledge ||
                      Object.values(spec.mounts || {}).some(
                        (mount) => (mount as CaseConfig).role !== 'case'
                      )) && (
                      <button onClick={() => chooseMounting('gasket')}>
                        Remove rigid supports
                      </button>
                    )}
                  <Field
                    label="Manufacturing preset"
                    value={spec.supplier || 'custom'}
                    choices={[JLC_PRESET, 'custom']}
                    onChange={(value) => {
                      if (value === JLC_PRESET) {
                        change((source) => applyPreset(source, name));
                      } else {
                        edit(['supplier'], 'custom');
                      }
                    }}
                  />
                  <Field
                    label="Enclosure construction"
                    value={spec.construction || 'cover'}
                    choices={['cover', 'midframe']}
                    onChange={(value) =>
                      change((source) => {
                        let result = editCase(
                          source,
                          name,
                          ['construction'],
                          value
                        );
                        if (
                          value === 'midframe' &&
                          spec.supplier === JLC_PRESET
                        ) {
                          result = applyPreset(result, name);
                        }
                        return result;
                      })
                    }
                  />
                  {field(
                    ['profile'],
                    'Board profile',
                    '',
                    refs.filter((ref) => !ref.startsWith('sketches.'))
                  )}
                  <ProfilePreview
                    label="Board profile"
                    model={plan?.model || features[spec.profile]?.model}
                  />
                  {data.designs.regions?.[`${name}_keys`] && (
                    <>
                      {selection(
                        ['designs', 'regions', `${name}_keys`, 'select', 'ids'],
                        'Included layout points',
                        points
                      )}
                      {globalField(
                        ['designs', 'regions', `${name}_keys`, 'close'],
                        'Gap closing radius (mm)',
                        2
                      )}
                      {selection(
                        [
                          'designs',
                          'regions',
                          `${name}_switches`,
                          'select',
                          'ids',
                        ],
                        'Points with switch cutouts',
                        points
                      )}
                      <p>
                        PCB support and plate openings use the selected keys’
                        named envelopes. Edit their dimensions in Layout or
                        YAML.
                      </p>
                      <button
                        onClick={() => {
                          const bridgeId = `bridge_${Object.keys(data.designs.boundaries?.[`${name}_body`]?.bridges || {}).length + 1}`;
                          change((source) =>
                            editDesign(
                              source,
                              [
                                'designs',
                                'boundaries',
                                `${name}_body`,
                                'bridges',
                                bridgeId,
                              ],
                              {
                                from: { ref: points[0] },
                                to: { ref: points[points.length - 1] },
                                width: 12,
                              }
                            )
                          );
                        }}
                      >
                        Add bridge
                      </button>
                      {Object.keys(
                        data.designs.boundaries?.[`${name}_body`]?.bridges || {}
                      ).map((id) => (
                        <Card key={id}>
                          <legend>{id}</legend>
                          {globalField(
                            [
                              'designs',
                              'boundaries',
                              `${name}_body`,
                              'bridges',
                              id,
                              'from',
                              'ref',
                            ],
                            'Bridge start',
                            '',
                            points
                          )}
                          {globalField(
                            [
                              'designs',
                              'boundaries',
                              `${name}_body`,
                              'bridges',
                              id,
                              'to',
                              'ref',
                            ],
                            'Bridge end',
                            '',
                            points
                          )}
                          {globalField(
                            [
                              'designs',
                              'boundaries',
                              `${name}_body`,
                              'bridges',
                              id,
                              'width',
                            ],
                            'Bridge width (mm)',
                            12
                          )}
                        </Card>
                      ))}
                    </>
                  )}
                  {!data.designs.regions?.[`${name}_keys`] && (
                    <p>
                      This case uses existing profiles. Select a profile above;
                      its custom boundary remains in the advanced editor.
                    </p>
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <p>
                    Choose a process for each part. The JLCCNC preset uses
                    depth-dependent tooling. Supplier minimums differ from our
                    case defaults.
                  </p>
                  <p>
                    <a href={JLC_GUIDE} target="_blank" rel="noreferrer">
                      JLCCNC design guidance
                    </a>
                  </p>
                  <p>
                    CNC adds corner relief using each part’s cutter diameter
                    when you generate. Required openings stay clear; walls,
                    plate webs, and mounting posts are checked before relief is
                    applied.
                  </p>
                  {[
                    'bottom',
                    'top',
                    'plate',
                    ...(spec.construction === 'midframe' ? ['middle'] : []),
                  ].map((part) => (
                    <Card key={part}>
                      <legend>{part}</legend>
                      <Field
                        label={`${part} process`}
                        value={spec.manufacturing?.[part]?.process || ''}
                        choices={['', 'fdm', 'cnc']}
                        onChange={(value) => setProcess(part, value)}
                      />
                      {field(
                        ['manufacturing', part, 'material'],
                        `${part} material`,
                        ''
                      )}
                      {field(
                        ['manufacturing', part, 'min_wall'],
                        `${part} minimum wall (mm)`,
                        1.2
                      )}
                      {spec.manufacturing?.[part]?.process === 'cnc' ? (
                        <>
                          {field(
                            ['manufacturing', part, 'cutter'],
                            `${part} cutter diameter (mm)`,
                            3
                          )}
                          {field(
                            ['manufacturing', part, 'reach'],
                            `${part} usable cutter reach (mm)`,
                            25
                          )}
                          {field(
                            ['manufacturing', part, 'drill'],
                            `${part} drill diameter (mm)`,
                            ''
                          )}
                          {selection(
                            [
                              'designs',
                              'assemblies',
                              name,
                              'manufacturing',
                              part,
                              'setups',
                            ],
                            `${part} machining setups`,
                            ['top', 'bottom', 'left', 'right', 'front', 'back']
                          )}
                          {field(
                            ['manufacturing', part, 'stock', 0],
                            `${part} stock X (mm)`,
                            300
                          )}
                          {field(
                            ['manufacturing', part, 'stock', 1],
                            `${part} stock Y (mm)`,
                            300
                          )}
                          {field(
                            ['manufacturing', part, 'stock', 2],
                            `${part} stock Z (mm)`,
                            30
                          )}
                          <p>
                            Setup names refer to the unrotated part. Side
                            openings need an accessible side setup.
                          </p>
                        </>
                      ) : (
                        <>
                          {field(
                            ['manufacturing', part, 'nozzle'],
                            `${part} nozzle width (mm)`,
                            0.4
                          )}
                          {field(
                            ['manufacturing', part, 'layer'],
                            `${part} layer height (mm)`,
                            0.2
                          )}
                          {field(
                            ['manufacturing', part, 'orientation'],
                            `${part} print orientation`,
                            'interior-up',
                            ['interior-up', 'interior-down', 'side']
                          )}
                          {field(
                            ['manufacturing', part, 'build', 0],
                            `${part} build X (mm)`,
                            220
                          )}
                          {field(
                            ['manufacturing', part, 'build', 1],
                            `${part} build Y (mm)`,
                            220
                          )}
                          {field(
                            ['manufacturing', part, 'build', 2],
                            `${part} build Z (mm)`,
                            250
                          )}
                          {field(
                            ['manufacturing', part, 'supports'],
                            `${part} supports`,
                            'allowed',
                            ['allowed', 'avoid']
                          )}
                        </>
                      )}
                    </Card>
                  ))}
                </>
              )}
              {step === 2 && (
                <>
                  <Field
                    label="Mounting system"
                    value={spec.mounting || ''}
                    choices={['', ...MOUNT_STYLES]}
                    onChange={chooseMounting}
                  />
                  {spec.mounting === 'gasket' &&
                    (spec.ledge ||
                      Object.values(spec.mounts || {}).some(
                        (mount) => (mount as CaseConfig).role !== 'case'
                      )) && (
                      <button onClick={() => chooseMounting('gasket')}>
                        Remove rigid supports
                      </button>
                    )}
                  <Field
                    label="Mount / gasket count"
                    value={spec.mount_count ?? ''}
                    onChange={chooseCount}
                  />
                  <p>
                    Counts include manual contacts. Case-closing screws are
                    separate. Tray supports reuse PCB holes.
                  </p>
                  <button
                    title="Place the requested contacts on clear edges; preserve manual edits and add separate case-closing screws."
                    onClick={() => setAutomatic(spec.mounting)}
                  >
                    Redistribute automatic mounts
                  </button>
                  <p>
                    {
                      {
                        tray: 'PCB posts connect the internal stack to the lower shell.',
                        top: 'Plate tabs attach to the upper shell.',
                        bottom:
                          'The plate attaches to supports on the lower shell.',
                        gasket:
                          'The plate and attached PCB float. Case screws close the shells independently.',
                      }[spec.mounting as string]
                    }
                  </p>
                  {field(['pcb_profile'], 'PCB envelope profile', '', [
                    '',
                    ...refs,
                  ])}
                  {field(['pcb_z'], 'PCB underside height (mm)', 6)}
                  {spec.stackup && (
                    <p>
                      PCB and plate dimensions are shared with Design setup →
                      Stackup.
                    </p>
                  )}
                  {field(['pcb_thickness'], 'PCB thickness (mm)', 1.6)}
                  {spec.mounting === 'gasket' ? (
                    <>
                      {field(['gasket', 'kind'], 'Gasket interface', 'pads', [
                        'pads',
                        'sleeves',
                      ])}
                      {field(
                        ['gasket', 'thickness'],
                        'Gasket free thickness / sleeve wall (mm)',
                        2
                      )}
                      {field(
                        ['gasket', 'compression'],
                        'Gasket compression fraction',
                        0.2
                      )}
                      {field(
                        ['gasket', 'fit'],
                        'Pocket / sleeve inner clearance (mm)',
                        0.2
                      )}
                      {field(
                        ['gasket', 'travel_up'],
                        'Upward travel (mm)',
                        0.2
                      )}
                      {field(
                        ['gasket', 'travel_down'],
                        'Downward travel (mm)',
                        0.2
                      )}
                      {field(
                        ['gasket', 'travel_side'],
                        'Lateral movement allowance (mm)',
                        0.1
                      )}
                      <p>
                        Choose contact regions below. Pockets and wall reliefs
                        follow them. Travel shows clearance, not simulated flex.
                      </p>
                      <details>
                        <summary>Advanced / Manual gasket contacts</summary>
                        <button
                          onClick={() =>
                            edit(
                              [
                                'gaskets',
                                `contact_${Object.keys(spec.gaskets || {}).length + 1}`,
                              ],
                              {
                                anchor: { ref: points[0], shift: [0, 0] },
                                size: [10, 6],
                              }
                            )
                          }
                        >
                          Add gasket contact
                        </button>
                        {assembly?.suggestions
                          .filter((item) => item.kind === 'gasket')
                          .slice(0, 16)
                          .map((item) => (
                            <button key={item.id} onClick={() => accept(item)}>
                              Add {item.id}
                            </button>
                          ))}
                        {Object.keys(spec.gaskets || {}).map((id) => (
                          <Card key={id} id={`case-feature-gaskets.${id}`}>
                            <legend>{id}</legend>
                            {spec.gaskets[id].anchor?.feature ? (
                              <p>
                                Anchored to {spec.gaskets[id].anchor.feature}
                              </p>
                            ) : (
                              field(
                                ['gaskets', id, 'anchor', 'ref'],
                                'Contact anchor',
                                '',
                                points
                              )
                            )}
                            {local(
                              ['gaskets', id, 'anchor', 'shift'],
                              ['Contact X offset (mm)', 'Contact Y offset (mm)']
                            )}
                            {local(
                              ['gaskets', id, 'size'],
                              ['Contact length (mm)', 'Contact width (mm)'],
                              [10, 6]
                            )}
                            {field(
                              ['gaskets', id, 'anchor', 'rotate'],
                              'Contact rotation (degrees)',
                              0
                            )}
                            <button
                              onClick={() =>
                                change((source) =>
                                  removeCaseField(source, name, ['gaskets', id])
                                )
                              }
                            >
                              Remove {id}
                            </button>
                          </Card>
                        ))}
                      </details>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          edit(['ledge'], { width: 2, thickness: 2 })
                        }
                      >
                        Add perimeter ledge
                      </button>
                      {spec.ledge && (
                        <Card>
                          <legend>Plate ledge</legend>
                          {field(['ledge', 'width'], 'Ledge width (mm)', 2)}
                          {field(
                            ['ledge', 'thickness'],
                            'Ledge thickness (mm)',
                            2
                          )}
                          <button
                            onClick={() =>
                              change((source) =>
                                removeCaseField(source, name, ['ledge'])
                              )
                            }
                          >
                            Remove ledge
                          </button>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <p>
                    Case dimensions are millimetres. Formulas using your layout
                    units remain editable.
                  </p>
                  <StackDiagram spec={plan?.parameters || spec} />
                  {field(['wall'], 'Wall thickness (mm)', 3)}
                  {field(['floor'], 'Floor thickness (mm)', 2)}
                  {field(['height'], 'Shell height (mm)', 24)}
                  {field(['bezel'], 'Bezel allowance (mm)', 8)}
                  {field(['fit'], 'Cavity fit allowance (mm)', 0.3)}
                  {field(['internal_radius'], 'Internal corner radius (mm)', 0)}
                  {field(['plate'], 'Plate thickness (mm)', 1.5)}
                  {field(['plate_z'], 'Plate underside height (mm)', 13)}
                  {field(
                    ['front_height'],
                    'Front exterior height (mm)',
                    spec.height
                  )}
                  {field(['typing_angle'], 'Typing angle (degrees)', 0)}
                  {field(['fillet'], 'Upper edge fillet (mm)', 0)}
                  {field(['chamfer'], 'Upper edge chamfer (mm)', 0)}
                  {field(['seam', 'type'], 'Alignment joint', 'plain', [
                    'plain',
                    'stepped',
                  ])}
                  {field(
                    ['seam', 'z'],
                    'Shell split height (mm)',
                    spec.plate_z
                  )}
                  {spec.seam?.type === 'stepped' && (
                    <>
                      {field(['seam', 'depth'], 'Registration depth (mm)', 1)}
                      {field(['seam', 'fit'], 'Registration fit (mm)', 0.2)}
                    </>
                  )}
                  {data.designs.boundaries?.[`${name}_body`] &&
                    globalField(
                      ['designs', 'boundaries', `${name}_body`, 'clearance'],
                      'Boundary clearance (mm)',
                      2
                    )}
                </>
              )}
              <div hidden={step !== 4}>
                <CaseComponents
                  board={board}
                  activeModel={activeModel}
                  onModelSelect={setActiveModel}
                  onSelect={(id) => choosePart(`board.components.${id}`)}
                  selectedId={
                    feature.startsWith('board.components.')
                      ? feature.slice('board.components.'.length)
                      : undefined
                  }
                  spec={spec}
                  assets={assets}
                  onAssets={setAssets}
                  onEdit={(path, value) => {
                    if (board?.native) {
                      edit(path, value);
                      return;
                    }
                    change((source) =>
                      editCaseChanges(
                        source,
                        name,
                        path,
                        path.reduce((item, key) => item?.[key], spec),
                        value
                      )
                    );
                  }}
                  onConfig={(source) => change(() => source)}
                />
              </div>
              {step === 4 && (
                <NativeCaseObjects
                  source={draft}
                  assembly={name}
                  layout={analysis.result?.layout}
                  onChange={change}
                />
              )}

              {step === 5 && (
                <>
                  <p>
                    Case screws close the shells. Plate and PCB mounts belong to
                    their selected support system.
                  </p>
                  <Field
                    label="Mount / gasket count"
                    value={spec.mount_count ?? ''}
                    onChange={chooseCount}
                  />
                  <p>
                    Counts include manual contacts. Case-closing screws are
                    separate. Tray supports reuse PCB holes.
                  </p>
                  <button
                    title="Place the requested contacts on clear edges; preserve manual edits and add separate case-closing screws."
                    onClick={() => setAutomatic(spec.mounting)}
                  >
                    Redistribute automatic mounts
                  </button>
                  {plan?.holeProposals?.length ? (
                    <Card>
                      <legend>Proposed PCB holes</legend>
                      <p>
                        New holes require a changed PCB. Copper and keepouts are
                        checked before inclusion.
                      </p>
                      {plan.holeProposals.map((hole) => (
                        <div key={hole.id}>
                          <button
                            disabled={analysis.stale}
                            onClick={() => {
                              edit(
                                ['board', 'holes'],
                                [...(spec.board?.holes || []), hole]
                              );
                              setAutomatic(spec.mounting);
                            }}
                          >
                            Include {hole.id} at{' '}
                            {hole.position.map((v) => v.toFixed(1)).join(', ')}{' '}
                            mm
                          </button>
                          <button
                            disabled={analysis.stale}
                            aria-label={`Reject ${hole.id}`}
                            onClick={() =>
                              edit(
                                ['board', 'rejected_holes'],
                                [...(spec.board?.rejected_holes || []), hole.id]
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ))}
                    </Card>
                  ) : null}
                  <details>
                    <summary>Advanced / Manual hardware</summary>
                    <button
                      onClick={() =>
                        edit(
                          [
                            'mounts',
                            `mount_${Object.keys(spec.mounts || {}).length + 1}`,
                          ],
                          {
                            role: spec.mounting === 'gasket' ? 'case' : 'plate',
                            anchor: { ref: points[0], shift: [0, 0] },
                            hole: 1,
                            post: 3,
                            depth: 4,
                            access: 'top',
                            hardware: 'plain',
                          }
                        )
                      }
                    >
                      Add mount
                    </button>
                    <h3>Suggested case fasteners</h3>
                    {assembly?.suggestions
                      .filter((item) => item.kind === 'mount')
                      .slice(0, 16)
                      .map((item) => (
                        <button key={item.id} onClick={() => accept(item)}>
                          Add {item.id}
                        </button>
                      ))}
                    {Object.keys(spec.mounts || {}).map((id) => (
                      <Card key={id} id={`case-feature-mounts.${id}`}>
                        <legend>{id}</legend>
                        {field(['mounts', id, 'role'], 'Mount target', 'case', [
                          'case',
                          'plate',
                          'pcb',
                        ])}
                        {spec.mounts[id].anchor?.feature ? (
                          <p>Anchored to {spec.mounts[id].anchor.feature}</p>
                        ) : (
                          field(
                            ['mounts', id, 'anchor', 'ref'],
                            'Mount anchor',
                            '',
                            points
                          )
                        )}
                        {local(
                          ['mounts', id, 'anchor', 'shift'],
                          ['Mount X offset (mm)', 'Mount Y offset (mm)']
                        )}
                        {diameter(
                          ['mounts', id, 'hole'],
                          'Hole diameter (mm)',
                          1
                        )}
                        {diameter(
                          ['mounts', id, 'post'],
                          'Post diameter (mm)',
                          3
                        )}
                        {field(
                          ['mounts', id, 'depth'],
                          'Hole depth (mm)',
                          spec.height
                        )}
                        {field(
                          ['mounts', id, 'access'],
                          'Insertion direction',
                          'top',
                          ['top', 'bottom']
                        )}
                        {field(
                          ['mounts', id, 'hardware'],
                          'Fastener pocket',
                          'plain',
                          ['plain', 'insert', 'nut', 'tapped']
                        )}
                        {spec.mounts[id].hardware !== 'plain' && (
                          <>
                            {diameter(
                              ['mounts', id, 'pocket'],
                              'Pocket diameter / nut across-flats (mm)',
                              1.5
                            )}
                            {field(
                              ['mounts', id, 'pocket_depth'],
                              'Pocket depth (mm)',
                              ''
                            )}
                            {field(
                              ['mounts', id, 'thread'],
                              'Thread specification',
                              ''
                            )}
                          </>
                        )}
                        {field(
                          ['mounts', id, 'min_wall'],
                          'Material around pocket (mm)',
                          1.5
                        )}
                        <button
                          onClick={() =>
                            change((source) =>
                              removeCaseField(source, name, ['mounts', id])
                            )
                          }
                        >
                          Remove {id}
                        </button>
                      </Card>
                    ))}
                  </details>
                </>
              )}
              {step === 6 && (
                <>
                  <p>
                    Inspect the complete enclosure and the individual parts.
                    STEP and STL come from the same solid geometry.
                  </p>
                  {!processes && (
                    <Status>
                      Choose manufacturing processes for all three parts.
                    </Status>
                  )}
                  {!Object.keys(spec.mounts || {}).length && (
                    <Status>
                      No fasteners are declared. Add mounting hardware or
                      explicitly review your custom attachment geometry.
                    </Status>
                  )}
                  <CaseReview
                    findings={findings}
                    onReview={(path) => {
                      const local =
                        path.split(`assemblies.${name}.`)[1] || path;
                      const target =
                        FINDING_STEPS.find(([pattern]) =>
                          pattern.test(local)
                        )?.[1] || 'Layout';
                      const node = findTreeNode(tree, local);
                      if (node) {
                        chooseNode(node);
                      } else {
                        setStep(CASE_STEPS.indexOf(target));
                        setFeature(local);
                      }
                      setInspectorOpen(true);
                      setView('plan');
                    }}
                  />
                  {session ? (
                    <button onClick={session.onExport}>
                      Export case files
                    </button>
                  ) : (
                    <>
                      <label>
                        <span>
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) =>
                              setConfirmed(event.target.checked)
                            }
                          />{' '}
                          I reviewed dimensions, hardware and manufacturing
                          findings.
                        </span>
                      </label>
                      <Controls>
                        {!embedded && (
                          <button
                            onClick={apply}
                            disabled={blocked || !confirmed}
                          >
                            Apply design
                          </button>
                        )}
                        <button
                          disabled={blocked || !confirmed}
                          onClick={() =>
                            preview.result &&
                            void createZip(
                              preview.result,
                              draft,
                              context?.injectionInput,
                              false,
                              true,
                              assets
                            )
                          }
                        >
                          Download ZIP
                        </button>
                      </Controls>
                    </>
                  )}
                  <p>
                    Physical fit and suspension feel require a fabricated
                    prototype.
                  </p>
                </>
              )}
            </Form>
            <Preview>
              <Controls>
                {['plan', 'assembled', 'exploded', 'section', 'part'].map(
                  (mode) => (
                    <button
                      key={mode}
                      aria-label={mode}
                      aria-pressed={view === mode}
                      onClick={() => setView(mode)}
                    >
                      {mode === 'plan' ? '2D' : mode}
                    </button>
                  )
                )}
                <span>
                  {name} · {spec.mounting}
                </span>
              </Controls>
              {staleSource && (
                <Status role="alert">
                  The source changed. Cancel and reopen before applying.
                </Status>
              )}
              {analysis.error && <Status role="alert">{analysis.error}</Status>}
              {transformed.error && (
                <Status role="alert">{transformed.error}</Status>
              )}
              {(error || preview.error) && (
                <Status role="alert">
                  {error ||
                    (preview.diagnostics.length
                      ? 'Generation needs attention. Open Review for grouped findings.'
                      : preview.error)}
                </Status>
              )}
              {disconnected && (
                <Status>
                  The boundary contains separate regions. Choose keys for each
                  cluster, choose an existing board outline, or add a bridge.
                  Use separate cases for separate keyboard halves.
                </Status>
              )}
              {(error || preview.error || preview.stale) && assembly && (
                <Status role="status">Showing the last valid geometry.</Status>
              )}
              {preview.pending && !error && !preview.error && (
                <Status role="status">Updating geometry…</Status>
              )}
              {view === 'plan' && (
                <CasePlanPreview
                  analysis={plan}
                  pcb={board?.model}
                  cutouts={(plan?.parameters.cutouts || spec.cutouts || [])
                    .map((ref: string) => features[ref]?.model)
                    .filter(Boolean)}
                  selected={feature}
                  onSelect={(value) => {
                    setFeature(value);
                    setTreeSelection(value);
                  }}
                  onEdit={editPlacement}
                  onAdd={addPlacement}
                  onRemove={removePlacement}
                  onDuplicate={duplicatePlacement}
                />
              )}
              {view !== 'plan' && (
                <View>
                  {assembly ? (
                    <AssemblyPreview
                      parts={assembly.parts}
                      cases={previewCases}
                      exploded={view === 'exploded'}
                      mode={
                        view === 'section'
                          ? 'section'
                          : view === 'part'
                            ? 'part'
                            : 'assembly'
                      }
                      selected={selected}
                      selectedParts={selectedParts}
                      onSelect={choosePart}
                      hidden={hidden.flatMap((id) => treeParts(tree, id))}
                      travel={travel}
                      lateral={lateral}
                      angle={Number(assembly.parameters?.typing_angle || 0)}
                    />
                  ) : (
                    <Status>
                      Define a connected layout to build your first preview.
                    </Status>
                  )}
                  {board &&
                    step === 4 &&
                    feature.startsWith('board.components.') && (
                      <CaseModelInset
                        board={board}
                        id={feature.slice('board.components.'.length)}
                        spec={spec}
                        assets={assets}
                        selected={activeModel}
                        onSelect={setActiveModel}
                        onChange={(models) =>
                          edit(
                            [
                              'board',
                              'models',
                              feature.slice('board.components.'.length),
                            ],
                            models
                          )
                        }
                      />
                    )}
                </View>
              )}
              {view !== 'plan' && (
                <Controls>
                  {Object.keys(assembly?.parts || {})
                    .filter((part) => !assembly?.parts[part].reference)
                    .map((part) => (
                      <button
                        key={part}
                        aria-pressed={selected === part}
                        onClick={() => choosePart(part)}
                      >
                        {part.replace(`${name}_`, '')}
                      </button>
                    ))}
                  <select
                    aria-label="Inspect part"
                    value={
                      selectedParts.find((part) => assembly?.parts[part]) ||
                      selected
                    }
                    onChange={(event) => choosePart(event.target.value)}
                  >
                    <option value="">Choose part or reference</option>
                    {Object.keys(assembly?.parts || {}).map((part) => (
                      <option key={part} value={part}>
                        {part.replace(`${name}_`, '')}
                      </option>
                    ))}
                  </select>
                </Controls>
              )}
              {spec.mounting === 'gasket' && view !== 'plan' && (
                <details>
                  <summary>Preview displacement</summary>
                  <p>
                    Preview displacement — the plate, PCB and attached
                    components move together.
                  </p>
                  <Motion>
                    {spec.mounting === 'gasket' && (
                      <label>
                        Preview vertical displacement (mm)
                        <input
                          type="range"
                          aria-label="Suspension travel"
                          min={-Number(movement.travel_down ?? 0.2)}
                          max={Number(movement.travel_up ?? 0.2)}
                          step="0.01"
                          value={travel}
                          onChange={(event) =>
                            setTravel(Number(event.target.value))
                          }
                        />
                        <span>{travel.toFixed(2)} mm</span>
                      </label>
                    )}
                    {spec.mounting === 'gasket' && (
                      <label>
                        Preview lateral displacement (mm)
                        <input
                          type="range"
                          aria-label="Lateral travel"
                          min={-Number(movement.travel_side ?? 0.1)}
                          max={Number(movement.travel_side ?? 0.1)}
                          step="0.01"
                          value={lateral}
                          onChange={(event) =>
                            setLateral(Number(event.target.value))
                          }
                        />
                        <span>{lateral.toFixed(2)} mm</span>
                      </label>
                    )}
                  </Motion>
                </details>
              )}
              {feature && <p>Selected feature: {feature}</p>}
              {selected && preview.result?.solids?.[selected] && (
                <p>
                  {selected} ·{' '}
                  {preview.result.solids[selected].volume.toFixed(1)} mm³
                </p>
              )}
            </Preview>
          </Body>
          <Footer>
            <span role="status">
              {preview.pending
                ? 'Generating…'
                : preview.stale
                  ? 'Case needs regeneration'
                  : 'Current geometry'}{' '}
              · {tree.find((node) => node.id === 'components')?.count || 0}{' '}
              components {board ? `· PCB ${board.thickness} mm` : ''}
            </span>
            <button
              onClick={() => {
                setStep(6);
                setInspectorOpen(true);
              }}
            >
              Review {findings.filter((f) => f.severity === 'error').length}{' '}
              blockers · {findings.filter((f) => f.severity !== 'error').length}{' '}
              checks
            </button>
            {preview.pending && (
              <button onClick={preview.cancel}>Cancel generation</button>
            )}
          </Footer>
        </>
      )}
    </Shell>
  );
}
