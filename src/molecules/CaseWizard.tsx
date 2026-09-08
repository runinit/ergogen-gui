import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDocument } from 'yaml';
import styled from 'styled-components';
import { useConfigContext } from '../context/ConfigContext';
import { useCasePreview, useCaseAnalysis } from '../hooks/useCasePreview';
import {
  appendDesignRef,
  CASE_STEPS,
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
import { pickCaseFeature } from '../utils/caseSelection';
import Field, { CaseHelp } from './CaseField';
import CasePlanPreview, {
  ProfilePreview,
  StackDiagram,
} from './CasePlanPreview';
import { loadAssets, saveAssets } from '../utils/caseAssets';
import CaseComponents from './CaseComponents';
import CaseControlHelp from './CaseControlHelp';
import { CaseConfig, CasePlacement } from '../types/case';
import { applyPreset, JLC_GUIDE, JLC_PRESET } from '../utils/casePresets';

const Shell = styled.section`
  position: fixed;
  inset: 0;
  z-index: ${theme.caseWizard.overlay};
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
    border-radius: ${theme.caseWizard.radius};
    background: ${theme.colors.backgroundLighter};
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
    width: auto;
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
  padding: ${theme.caseWizard.padding};
  border-bottom: 1px solid ${theme.colors.border};
  h1 {
    margin: 0;
    font-size: ${theme.fontSizes.h3};
  }
  p {
    margin: 0;
    color: ${theme.colors.textDarker};
  }
`;
const Steps = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.caseWizard.gap};
  padding: ${theme.caseWizard.gap};
`;
const Body = styled.div`
  display: grid;
  grid-template-columns: minmax(280px, ${theme.caseWizard.formWidth}) minmax(
      0,
      1fr
    );
  overflow: hidden;
  flex: 1;
  min-height: 0;
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    grid-template-columns: 1fr;
  }
`;
const Form = styled.div`
  padding: ${theme.caseWizard.padding};
  overflow: auto;
  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: ${theme.caseWizard.gap};
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
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: ${theme.caseWizard.gap};
  background: ${theme.colors.backgroundLight};
  min-height: 0;
  overflow: auto;
`;
const View = styled.div`
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

type Props = { onClose: () => void };
export default function CaseWizard({ onClose }: Props) {
  const context = useConfigContext();
  const [initialError] = useState(() => {
    try {
      const source = context?.getRealtimeConfigInput() || '';
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
  });
  if (initialError) {
    return (
      <Shell role="dialog" aria-modal="true" aria-label="Case designer">
        <Status role="alert">{initialError}</Status>
        <button onClick={onClose}>Cancel</button>
      </Shell>
    );
  }
  return <CaseDraft onClose={onClose} />;
}

function CaseDraft({ onClose }: Props) {
  const context = useConfigContext();
  const base = useRef(context?.getRealtimeConfigInput() || '');
  const [name, setName] = useState(() => caseNames(base.current)[0] || 'case');
  const [draft, setDraft] = useState(() =>
    caseNames(base.current).length
      ? base.current
      : createCase(base.current, 'case')
  );
  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [automatic, setAutomatic] = useState('');
  const history = useRef<string[]>([]);
  useEffect(() => {
    let live = true;
    loadAssets()
      .then((value) => {
        if (live) {
          setAssets(value);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [error, setError] = useState('');
  const [view, setView] = useState('plan');
  const [selected, setSelected] = useState('');
  const [feature, setFeature] = useState('');
  const [travel, setTravel] = useState(0);
  const [lateral, setLateral] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [nextName, setNextName] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const doc = useMemo(() => parseDocument(draft), [draft]);
  const data = useMemo(() => doc.toJS(), [doc]);
  const spec = data?.designs?.assemblies?.[name] || {};
  const preview = useCasePreview(draft, context?.injectionInput, assets);
  const analysis = useCaseAnalysis(draft, context?.injectionInput, assets);
  const plan = analysis.result?.designs?.analysis?.[name];
  const board = analysis.result?.designs?.boards?.[name];
  const assembly = preview.result?.designs?.assemblies[name];
  const previewCases = useMemo(
    () => ({ ...preview.result?.cases, ...preview.result?.solids }),
    [preview.result]
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
  const points = Object.keys(
    (analysis.result?.points ||
      preview.result?.points ||
      context?.results?.points ||
      {}) as object
  );
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
    base.current !== (context?.getRealtimeConfigInput() || '');
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
  const pick = (point: number[]) => {
    if (!assembly) {
      return;
    }
    const id = pickCaseFeature(assembly, point);
    if (!id) {
      return;
    }
    setFeature(id);
    setView('plan');
    setStep(id.startsWith('mounts.') ? 5 : id.startsWith('gaskets.') ? 2 : 4);
  };
  const change = (transform: (source: string) => string) => {
    try {
      const next = transform(draft);
      const parsed = parseDocument(next);
      if (parsed.errors.length) {
        throw new Error(parsed.errors[0].message);
      }
      history.current.push(draft);
      setDraft(next);
      setError('');
      setConfirmed(false);
    } catch (caught) {
      setError(String(caught));
    }
  };
  const edit = (path: SourcePath, value: unknown) =>
    change((source) => {
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
      value={doc.getIn(['designs', 'assemblies', name, ...path]) ?? fallback}
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
    const value = path.reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      { designs: chosen }
    );
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
  const addComponent = (kind: 'component' | 'opening') => {
    const id = `${name}_${kind}_${Object.keys(data.designs.components || {}).length + 1}`;
    change((source) => {
      const withComponent = editDesign(source, ['designs', 'components', id], {
        anchor: { ref: points[0], shift: [0, 0] },
        size: [18, 10],
        height: [3, 8],
        motion: 'fixed',
      });
      return appendDesignRef(
        withComponent,
        [
          'designs',
          'assemblies',
          name,
          kind === 'opening' ? 'openings' : 'components',
        ],
        `components.${id}`
      );
    });
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
    edit(['mounting'], value);
    setAutomatic(String(value));
    setView('plan');
  };
  const redistribute = () =>
    change((source) => {
      let result = source;
      for (const table of ['mounts', 'gaskets']) {
        for (const [id, definition] of Object.entries(spec[table] || {})) {
          if ((definition as CaseConfig).placement?.owner === 'automatic') {
            result = removeCaseField(result, name, [table, id]);
          }
        }
      }
      for (const suggestion of plan?.suggestions || []) {
        const table = suggestion.kind === 'gasket' ? 'gaskets' : 'mounts';
        if (
          spec[table]?.[suggestion.id]?.placement?.owner !== 'automatic' &&
          spec[table]?.[suggestion.id]
        ) {
          continue;
        }
        result = editCase(result, name, [table, suggestion.id], {
          ...suggestion.definition,
          placement: { ...suggestion.definition.placement, owner: 'automatic' },
        });
      }
      return result;
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
    edit([table, id], {
      ...template,
      anchor: { shift: position, rotate: angle },
      placement: { owner: 'manual', edge },
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
        value === 'cnc' ? PROCESS_DEFAULTS.cnc : PROCESS_DEFAULTS.fdm;
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
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Case designer"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
        if (event.key !== 'Tab') {
          return;
        }
        const focusable = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled)'
        );
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
      <CaseControlHelp root={dialog} />
      <Header>
        <div>
          <h1>Case designer</h1>
          <p>
            Full enclosures · CNC and FDM
            {process.env.REACT_APP_DEPLOYMENT_CHANNEL === 'preview'
              ? ` · Preview ${process.env.REACT_APP_BUILD_REVISION?.slice(0, 7)}`
              : ''}
          </p>
        </div>
        <button onClick={onClose}>Cancel</button>
      </Header>
      <Controls>
        <button
          onClick={preview.generate}
          disabled={
            preview.pending ||
            analysis.stale ||
            !!analysis.error ||
            !spec.mounting
          }
          title="Build and validate the current draft; edits only update the 2D plan."
        >
          {preview.pending ? 'Generating…' : 'Generate'}
        </button>
        {(preview.pending || preview.error) && (
          <button onClick={preview.generate}>Restart worker and retry</button>
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
      </Controls>
      <Steps aria-label="Case design steps">
        {CASE_STEPS.map((label, index) => (
          <button
            key={label}
            aria-current={step === index ? 'step' : undefined}
            onClick={() => setStep(index)}
          >
            {label}
          </button>
        ))}
      </Steps>
      <Body>
        <Form>
          <h2>{CASE_STEPS[step]}</h2>
          {(plan?.findings || [])
            .filter((issue) => issue.severity === 'error')
            .map((issue, index) => (
              <Status key={`${issue.feature}-${index}`}>
                <strong>{issue.message}</strong>
                <p>{issue.action}</p>
                <button
                  onClick={() => {
                    const path =
                      issue.feature.split(`assemblies.${name}.`)[1] || '';
                    setStep(
                      path.startsWith('board.components')
                        ? 4
                        : path.startsWith('board.holes') ||
                            path.startsWith('mounts')
                          ? 5
                          : path.startsWith('gasket')
                            ? 2
                            : path.startsWith('seam')
                              ? 3
                              : 0
                    );
                    setFeature(path);
                    setView('plan');
                  }}
                >
                  Review affected setting
                </button>
              </Status>
            ))}
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
                  spec.board ? `${spec.board.source}:${spec.board.name}` : ''
                }
                choices={[
                  '',
                  `layout:${name}_layout`,
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
                    change((text) => removeCaseField(text, name, ['board']));
                    return;
                  }
                  edit(['board'], { source, name: parts.join(':') });
                }}
              />
              {spec.board?.source === 'layout' && (
                <>
                  <Field
                    label="Switch family"
                    value={spec.board.family || ''}
                    choices={['', 'mx', 'choc-v1', 'choc-v2']}
                    onChange={(value) => edit(['board', 'family'], value)}
                  />
                  <p>
                    Layout board is a mechanical reference. Choose a switch
                    family to resolve the stack. Import your routed PCB before
                    manufacturing it.
                  </p>
                </>
              )}
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
                    if (value === 'midframe' && spec.supplier === JLC_PRESET) {
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
                  {globalField(
                    ['designs', 'regions', `${name}_keys`, 'outline'],
                    'Existing board outline',
                    '',
                    ['', ...Object.keys(data.outlines || {})]
                  )}
                  <ProfilePreview
                    label="Existing board outline"
                    model={features[`regions.${name}_keys`]?.model}
                  />
                  <p>
                    Choose an existing outline for the case boundary, or leave
                    it empty to build from selected layout points.
                  </p>
                  {!data.designs.regions[`${name}_keys`].outline && (
                    <>
                      {selection(
                        ['designs', 'regions', `${name}_keys`, 'where'],
                        'Included layout points',
                        points
                      )}
                      {globalField(
                        ['designs', 'regions', `${name}_keys`, 'close'],
                        'Gap closing radius (mm)',
                        2
                      )}
                    </>
                  )}
                  {globalField(
                    ['designs', 'regions', `${name}_switches`, 'size'],
                    'Switch cutout size (mm)',
                    14
                  )}
                  {globalField(
                    ['designs', 'regions', `${name}_switches`, 'corner_relief'],
                    'Switch corner relief radius (mm)',
                    0
                  )}
                  {selection(
                    ['designs', 'regions', `${name}_switches`, 'where'],
                    'Points with switch cutouts',
                    points
                  )}
                  <p>
                    Keep controller and mounting points out of the switch
                    selection.
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
                  This case uses existing profiles. Select a profile above; its
                  custom boundary remains in the advanced editor.
                </p>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <p>
                Choose a process for each part. The JLCCNC preset uses
                depth-dependent tooling. Supplier minimums differ from our case
                defaults.
              </p>
              <p>
                <a href={JLC_GUIDE} target="_blank" rel="noreferrer">
                  JLCCNC design guidance
                </a>
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
                        Setup names refer to the unrotated part. Side openings
                        need an accessible side setup.
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
              <button onClick={() => setAutomatic(spec.mounting)}>
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
                  {field(['gasket', 'travel_up'], 'Upward travel (mm)', 0.2)}
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
                          <p>Anchored to {spec.gaskets[id].anchor.feature}</p>
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
                    onClick={() => edit(['ledge'], { width: 2, thickness: 2 })}
                  >
                    Add perimeter ledge
                  </button>
                  {spec.ledge && (
                    <Card>
                      <legend>Plate ledge</legend>
                      {field(['ledge', 'width'], 'Ledge width (mm)', 2)}
                      {field(['ledge', 'thickness'], 'Ledge thickness (mm)', 2)}
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
              {field(['seam', 'z'], 'Shell split height (mm)', spec.plate_z)}
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
              spec={spec}
              assets={assets}
              onAssets={setAssets}
              onEdit={edit}
              onConfig={(source) => change(() => source)}
            />
          </div>
          {step === 4 && (
            <>
              <p>
                Enter measured envelopes. Moving components share the plate’s
                clearance envelope; openings cut the shells.
              </p>
              <Controls>
                <button onClick={() => addComponent('component')}>
                  Add component
                </button>
                <button onClick={() => addComponent('opening')}>
                  Add opening
                </button>
              </Controls>
              {[...(spec.components || []), ...(spec.openings || [])].map(
                (ref: string) => {
                  const id = ref.split('.')[1],
                    path = ['designs', 'components', id];
                  return (
                    <Card key={ref} id={`case-feature-${ref}`}>
                      <legend>{id}</legend>
                      {globalField(
                        [...path, 'anchor', 'ref'],
                        `${id} anchor`,
                        '',
                        points
                      )}
                      {globalField(
                        [...path, 'anchor', 'shift', 0],
                        `${id} X offset (mm)`,
                        0
                      )}
                      {globalField(
                        [...path, 'anchor', 'shift', 1],
                        `${id} Y offset (mm)`,
                        0
                      )}
                      {globalField(
                        [...path, 'anchor', 'rotate'],
                        `${id} rotation`,
                        0
                      )}
                      {globalField(
                        [...path, 'size', 0],
                        `${id} width (mm)`,
                        18
                      )}
                      {globalField(
                        [...path, 'size', 1],
                        `${id} length (mm)`,
                        10
                      )}
                      {globalField(
                        [...path, 'corner_radius'],
                        `${id} corner radius (mm)`,
                        0
                      )}
                      {globalField(
                        [...path, 'radius'],
                        `${id} optional circular radius (mm)`,
                        ''
                      )}
                      {globalField(
                        [...path, 'height', 0],
                        `${id} bottom (mm)`,
                        3
                      )}
                      {globalField([...path, 'height', 1], `${id} top (mm)`, 8)}
                      {globalField(
                        [...path, 'motion'],
                        `${id} attachment`,
                        'fixed',
                        ['fixed', 'floating']
                      )}
                      <button
                        onClick={() =>
                          change((source) =>
                            toggleDesignRef(
                              source,
                              [
                                'designs',
                                'assemblies',
                                name,
                                (spec.openings || []).includes(ref)
                                  ? 'openings'
                                  : 'components',
                              ],
                              ref
                            )
                          )
                        }
                      >
                        Remove {id} from case
                      </button>
                    </Card>
                  );
                }
              )}
            </>
          )}
          {step === 5 && (
            <>
              <p>
                Case screws close the shells. Plate and PCB mounts belong to
                their selected support system.
              </p>
              <button onClick={() => setAutomatic(spec.mounting)}>
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
                        {hole.position.map((v) => v.toFixed(1)).join(', ')} mm
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
                    {diameter(['mounts', id, 'hole'], 'Hole diameter (mm)', 1)}
                    {diameter(['mounts', id, 'post'], 'Post diameter (mm)', 3)}
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
                Inspect the complete enclosure and the individual parts. STEP
                and STL come from the same solid geometry.
              </p>
              {!processes && (
                <Status>
                  Choose manufacturing processes for all three parts.
                </Status>
              )}
              {!Object.keys(spec.mounts || {}).length && (
                <Status>
                  No fasteners are declared. Add mounting hardware or explicitly
                  review your custom attachment geometry.
                </Status>
              )}
              {findings.map((finding, index) => (
                <Card key={`${finding.feature}-${index}`}>
                  <legend>
                    {finding.severity} · {finding.code}
                  </legend>
                  <p>{finding.feature}</p>
                  <p>{finding.message}</p>
                </Card>
              ))}
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />{' '}
                  I reviewed dimensions, hardware and manufacturing findings.
                </span>
              </label>
              <Controls>
                <button onClick={apply} disabled={blocked || !confirmed}>
                  Apply design
                </button>
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
              <p>
                Physical fit and suspension feel require a fabricated prototype.
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
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                >
                  {mode}
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
          {(error || preview.error) && (
            <Status role="alert">{error || preview.error}</Status>
          )}
          {disconnected && (
            <Status>
              The boundary contains separate regions. Exclude helper points,
              choose an existing board outline, or add a bridge. Use separate
              cases for separate keyboard halves.
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
              onSelect={setFeature}
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
                  onSelect={setSelected}
                  onPick={pick}
                  travel={travel}
                  lateral={lateral}
                  angle={Number(assembly.parameters?.typing_angle || 0)}
                />
              ) : (
                <Status>
                  Define a connected layout to build your first preview.
                </Status>
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
                    onClick={() => setSelected(part)}
                  >
                    {part.replace(`${name}_`, '')}
                  </button>
                ))}
              <select
                aria-label="Inspect part"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
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
                Preview displacement — the plate, PCB and attached components
                move together.
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
              {selected} · {preview.result.solids[selected].volume.toFixed(1)}{' '}
              mm³
            </p>
          )}
        </Preview>
      </Body>
      <Footer>
        <button disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </button>
        <span>Draft changes are applied together.</span>
        <button
          disabled={step === CASE_STEPS.length - 1}
          onClick={() => setStep(step + 1)}
        >
          Next
        </button>
      </Footer>
    </Shell>
  );
}
