import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import { StudioShell, StudioActions, StudioField } from './StudioStyles';
import {
  compileSetup,
  CONTROLLERS,
  defaultSetup,
  DesignSetup,
  setupFindings,
  setupNets,
} from '../utils/designSetup';
import { loadTemplates, saveTemplate } from '../utils/assemblyTemplates';
import bundled from '../../.generated/footprints.json';
import componentFootprints from '../catalogue/footprints.json';
import { createEntry } from '../utils/footprintLibrary';
import { prepareFootprint } from '../utils/footprintService';
import type { FootprintInfo } from '../types/footprint';
import FootprintCanvas from './FootprintCanvas';
import { loadComponentModel, setupModels } from '../utils/componentModels';
import type { ModelBinding } from '../types/footprint';
import { graphicPoints, padOutline } from '../utils/footprintGeometry';

const Workspace = styled(StudioShell)<{
  $embedded?: boolean;
  $expanded?: boolean;
}>`
  position: ${(p) => (p.$embedded ? 'static' : 'fixed')};
  inset: 0;
  z-index: ${(p) => (p.$embedded ? 'auto' : 620)};
  ${(p) =>
    p.$embedded &&
    `height:auto; overflow:visible; > div {display:flex; flex-direction:column; overflow:visible;} > div > nav {display:none;} > div > main, > div > aside {padding:0; border:0; overflow:visible;} > div > main {flex:none; min-height:0;} svg[aria-label="Key assembly footprint editor"] {height:${p.$expanded ? theme.studio.expandedPreviewHeight : theme.studio.setupPreviewHeight};min-height:0;flex:none;} `}
  header {
    padding: ${theme.spacing.md};
    display: flex;
    gap: ${theme.spacing.md};
    align-items: center;
  }
  h1 {
    font-size: ${theme.fontSizes.h3};
    margin: 0;
    flex: 1;
  }
`;
const Body = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 320px;
  flex: 1;
  min-height: 0;
  nav,
  aside {
    overflow: auto;
    padding: ${theme.spacing.md};
    border: 1px solid ${theme.colors.border};
  }
  nav button {
    width: 100%;
    margin-bottom: ${theme.spacing.sm};
    justify-content: start;
  }
  main {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: ${theme.spacing.md};
  }
  main > svg {
    width: 100%;
    flex: 1;
    min-height: 260px;
    touch-action: none;
  }
  aside {
    text-align: left;
  }
  label {
    align-items: stretch;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.md};
  }
  @media (max-width: 900px) {
    grid-template-columns: 160px 1fr;
    aside {
      grid-column: 1 / -1;
      max-height: 40vh;
    }
  }
  @media (max-width: 560px) {
    display: flex;
    flex-direction: column;
    overflow: auto;
    nav {
      flex-shrink: 0;
      display: flex;
      overflow: auto;
    }
    nav button {
      width: auto;
      white-space: nowrap;
    }
    main {
      min-height: 320px;
    }
    aside {
      max-height: none;
      flex-shrink: 0;
    }
  }
`;
const SECTIONS = [
  'Layout',
  'Key assembly',
  'Controller and power',
  'Accessories',
  'Review',
] as const;
type Section = (typeof SECTIONS)[number];
type Role = 'switch' | 'diode' | 'led';
const ROLES: Role[] = ['switch', 'diode', 'led'];
const PREVIEW_SIZE = 32;
const SNAP = 0.25;
const catalogue: Record<string, string> = {
  ...bundled,
  ...componentFootprints,
};
const cache = new Map<string, FootprintInfo>();

export default function NewDesignWorkspace({
  onCreate,
  onCancel,
  initial,
  mode = 'design',
  embedded = false,
  onDraft,
}: {
  onCreate: (
    source: string,
    assets: Record<string, string>,
    injections?: string[][]
  ) => void;
  onCancel: () => void;
  initial?: DesignSetup;
  embedded?: boolean;
  onDraft?: (setup: DesignSetup) => void;
  mode?: 'design' | 'assembly';
}) {
  const [setup, setSetup] = useState(() =>
    initial ? structuredClone(initial) : defaultSetup()
  );
  useEffect(() => {
    onDraft?.(setup);
  }, [setup, onDraft]);
  const [section, setSection] = useState<Section>(
    mode === 'assembly' ? 'Key assembly' : 'Layout'
  );
  const [selected, setSelected] = useState<Role>('switch');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [info, setInfo] = useState<Partial<Record<Role, FootprintInfo>>>({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const panDrag = useRef<[number, number] | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (embedded) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, [embedded]);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [controllerInfo, setControllerInfo] = useState<FootprintInfo>();
  const controller = CONTROLLERS.find((item) => item.id === setup.controller);
  useEffect(() => {
    const abort = new AbortController();
    setControllerInfo(undefined);
    if (controller) {
      void prepareFootprint(
        createEntry(controller.name, catalogue[controller.provider], 'ergogen'),
        abort.signal
      )
        .then((value) => {
          if (!abort.signal.aborted) {
            setControllerInfo(value.info);
          }
        })
        .catch((reason) => {
          if (!abort.signal.aborted) {
            setError(String(reason));
          }
        });
    }
    return () => abort.abort();
  }, [controller]);
  const modelNames = useMemo(
    () =>
      section === 'Controller and power'
        ? controller?.model
          ? [controller.model]
          : []
        : setupModels({ family: setup.family, mounting: setup.mounting }),
    [section, controller, setup.family, setup.mounting]
  );
  const [models, setModels] = useState<ModelBinding[]>([]);
  const [assets, setAssets] = useState<Record<string, string>>({});
  useEffect(() => {
    if (view !== '3d') {
      return;
    }
    let active = true;
    setModels([]);
    void Promise.all(modelNames.map(loadComponentModel))
      .then((entries) => {
        if (active) {
          setModels(entries.map((entry) => entry.model));
          setAssets(Object.assign({}, ...entries.map((entry) => entry.assets)));
        }
      })
      .catch((reason) => {
        if (active) {
          setError(String(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [view, modelNames]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ role: Role; offset: [number, number] } | null>(null);
  const findings = useMemo(() => setupFindings(setup), [setup]);
  const update = <K extends keyof DesignSetup>(key: K, value: DesignSetup[K]) =>
    setSetup((before) => ({ ...before, [key]: value }));
  const move = (
    role: Role,
    values: Partial<DesignSetup['template']['switch']>
  ) =>
    setSetup((before) => ({
      ...before,
      template: {
        ...before.template,
        [role]: { ...before.template[role], ...values },
      },
    }));
  useEffect(() => {
    const abort = new AbortController();
    const providers: Record<Role, string> = {
      switch:
        setup.family === 'mx'
          ? 'ceoloide/switch_mx'
          : 'ceoloide/switch_choc_v1_v2',
      diode: 'ceoloide/diode_tht_sod123',
      led: 'ceoloide/led_sk6812mini-e',
    };
    void Promise.all(
      ROLES.map(async (role) => {
        const params =
          role === 'switch'
            ? {
                hotswap: setup.mounting === 'hotswap',
                solder: setup.mounting === 'solder',
                from: 'COLUMN',
                to: 'SWITCH',
                ...(setup.family !== 'mx'
                  ? {
                      choc_v1_support: setup.family === 'choc_v1',
                      choc_v2_support: setup.family === 'choc_v2',
                    }
                  : {}),
              }
            : {};
        const key = JSON.stringify([providers[role], params]);
        let result = cache.get(key);
        if (!result) {
          result = (
            await prepareFootprint(
              createEntry(role, catalogue[providers[role]], 'ergogen'),
              abort.signal,
              params
            )
          ).info;
          cache.set(key, result);
        }
        return [role, result] as const;
      })
    )
      .then((entries) => {
        if (!abort.signal.aborted) {
          setInfo(Object.fromEntries(entries));
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) {
          setError(String(reason));
        }
      });
    return () => abort.abort();
  }, [setup.family, setup.mounting]);
  const number = (
    key: 'columns' | 'rows' | 'thumbs' | 'pitch',
    label: string,
    min: number,
    max: number
  ) => (
    <StudioField>
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={key === 'pitch' ? 0.05 : 1}
        value={setup[key]}
        onChange={(event) => update(key, Number(event.target.value))}
      />
    </StudioField>
  );
  const option = <K extends keyof DesignSetup>(
    key: K,
    label: string,
    choices: [string, string][]
  ) => (
    <StudioField>
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(setup[key])}
        onChange={(event) => update(key, event.target.value as DesignSetup[K])}
      >
        {choices.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </StudioField>
  );
  const toggle = (
    key: 'diode' | 'led' | 'encoder' | 'reset',
    label: string
  ) => (
    <label>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={setup[key]}
        onChange={(event) => update(key, event.target.checked)}
      />
    </label>
  );
  const create = async () => {
    if (creating) {
      return;
    }
    setCreating(true);
    try {
      const source = compileSetup(setup);
      const controller = CONTROLLERS.find(
        (item) => item.id === setup.controller
      );
      const entries = await Promise.all(
        [
          ...setupModels(setup),
          ...(controller?.model ? [controller.model] : []),
        ].map(loadComponentModel)
      );
      onCreate(
        source,
        Object.assign({}, ...entries.map((entry) => entry.assets)),
        controller?.provider.startsWith('catalogue/')
          ? [['footprint', controller.provider, catalogue[controller.provider]]]
          : []
      );
      setCreating(false);
    } catch (reason) {
      setError(String(reason));
      setCreating(false);
    }
  };
  const assembly = section === 'Key assembly';
  return (
    <Workspace
      ref={dialog}
      $embedded={embedded}
      $expanded={expanded}
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label="New design workspace"
      onKeyDown={(event) => {
        if (embedded) {
          return;
        }
        if (event.key === 'Tab') {
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input, select, [tabindex="0"]'
            )
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        if (event.key === 'Escape') {
          onCancel();
        }
      }}
    >
      {(!embedded || !onDraft) && (
        <header>
          <h1>
            {mode === 'assembly'
              ? 'Edit key assembly'
              : initial
                ? 'Design setup'
                : 'New design'}
          </h1>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={create} disabled={creating} data-primary="true">
            {mode === 'assembly'
              ? 'Apply to selection'
              : initial
                ? 'Apply setup'
                : findings.length
                  ? 'Create draft'
                  : 'Create design'}
          </button>
        </header>
      )}
      {error && <p role="alert">{error}</p>}
      <Body>
        <nav aria-label="Design setup">
          {(mode === 'assembly' ? (['Key assembly'] as const) : SECTIONS).map(
            (name) => (
              <button
                key={name}
                aria-pressed={name === section}
                onClick={() => setSection(name)}
              >
                {name}
              </button>
            )
          )}
        </nav>
        <main>
          {embedded &&
            option('family', 'Switch family', [
              ['mx', 'Cherry MX'],
              ['choc_v1', 'Kailh Choc V1'],
              ['choc_v2', 'Kailh Choc V2'],
            ])}
          <StudioActions>
            <button aria-pressed={view === '2d'} onClick={() => setView('2d')}>
              2D
            </button>
            <button aria-pressed={view === '3d'} onClick={() => setView('3d')}>
              3D component
            </button>
            {!embedded && (
              <strong>
                {assembly
                  ? 'Key assembly · millimetres'
                  : `${setup.columns} × ${setup.rows} matrix`}
              </strong>
            )}
            {(!embedded || expanded) && (
              <>
                <button
                  onClick={() => setZoom((value) => Math.min(4, value * 1.25))}
                >
                  Zoom in
                </button>
                <button
                  onClick={() =>
                    setZoom((value) => Math.max(0.4, value / 1.25))
                  }
                >
                  Zoom out
                </button>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPan([0, 0]);
                  }}
                >
                  Fit
                </button>
              </>
            )}
            {embedded && (
              <button
                aria-label={expanded ? 'Compact preview' : 'Expand preview'}
                title={expanded ? 'Compact preview' : 'Expand preview'}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            {assembly && (!embedded || expanded) && (
              <button
                aria-pressed={tool === 'pan'}
                onClick={() => setTool(tool === 'pan' ? 'select' : 'pan')}
              >
                Pan
              </button>
            )}
          </StudioActions>
          {view === '3d' && modelNames.length === 0 && (
            <p role="status">No verified model is bundled for this variant.</p>
          )}
          {view === '3d' ? (
            <FootprintCanvas
              info={
                section === 'Controller and power'
                  ? controllerInfo
                  : info.switch
              }
              models={
                section === 'Controller and power'
                  ? models
                  : models.map((model) => ({
                      ...model,
                      offset: [...setup.template.switch.at, 0],
                      rotate: [0, 0, setup.template.switch.rotate],
                    }))
              }
              assets={assets}
              selected={-1}
              onSelect={() => undefined}
              view="3d"
            />
          ) : section === 'Controller and power' && controllerInfo ? (
            <FootprintCanvas
              info={controllerInfo}
              models={[]}
              assets={{}}
              selected={-1}
              onSelect={() => undefined}
              view="2d"
            />
          ) : assembly ? (
            <svg
              ref={svg}
              role="img"
              aria-label="Key assembly footprint editor"
              viewBox={`${pan[0] - PREVIEW_SIZE / zoom / 2} ${pan[1] - PREVIEW_SIZE / zoom / 2} ${PREVIEW_SIZE / zoom} ${PREVIEW_SIZE / zoom}`}
              onPointerDown={(event) => {
                if (tool !== 'pan') {
                  return;
                }
                panDrag.current = [event.clientX, event.clientY];
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (panDrag.current && svg.current) {
                  const matrix = svg.current.getScreenCTM();
                  if (!matrix) {
                    return;
                  }
                  const dx = (event.clientX - panDrag.current[0]) / matrix.a;
                  const dy = (event.clientY - panDrag.current[1]) / matrix.d;
                  setPan(([x, y]) => [x - dx, y - dy]);
                  panDrag.current = [event.clientX, event.clientY];
                  return;
                }
                if (!drag.current || !svg.current) {
                  return;
                }
                const matrix = svg.current.getScreenCTM();
                if (!matrix) {
                  return;
                }
                const point = new DOMPoint(
                  event.clientX,
                  event.clientY
                ).matrixTransform(matrix.inverse());
                move(drag.current.role, {
                  at: [
                    Math.round((point.x - drag.current.offset[0]) * 4) / 4,
                    -Math.round((point.y - drag.current.offset[1]) * 4) / 4,
                  ],
                });
              }}
              onPointerUp={() => {
                drag.current = null;
                panDrag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
                panDrag.current = null;
              }}
            >
              <rect
                x="-9"
                y="-9"
                width="18"
                height="18"
                fill="none"
                stroke={theme.colors.border}
                strokeWidth="0.15"
              />
              <rect
                x="-7"
                y="-7"
                width="14"
                height="14"
                fill="none"
                stroke={theme.colors.textDark}
                strokeWidth="0.15"
              />
              {ROLES.filter((role) => role === 'switch' || setup[role]).map(
                (role) => {
                  const placement = setup.template[role];
                  return (
                    <g
                      key={role}
                      role="button"
                      tabIndex={0}
                      aria-label={`Move ${role}`}
                      transform={`translate(${placement.at[0]} ${-placement.at[1]}) rotate(${-placement.rotate})`}
                      onClick={() => setSelected(role)}
                      onKeyDown={(event) => {
                        const step = event.shiftKey ? 1 : SNAP;
                        const delta: Record<string, [number, number]> = {
                          ArrowLeft: [-step, 0],
                          ArrowRight: [step, 0],
                          ArrowUp: [0, step],
                          ArrowDown: [0, -step],
                        };
                        if (delta[event.key]) {
                          event.preventDefault();
                          move(role, {
                            at: [
                              placement.at[0] + delta[event.key][0],
                              placement.at[1] + delta[event.key][1],
                            ],
                          });
                          setSelected(role);
                        }
                        if (event.key === 'Enter') {
                          setSelected(role);
                        }
                      }}
                      onPointerDown={(event) => {
                        if (tool === 'pan') {
                          return;
                        }
                        const matrix = svg.current?.getScreenCTM();
                        if (!matrix) {
                          return;
                        }
                        const point = new DOMPoint(
                          event.clientX,
                          event.clientY
                        ).matrixTransform(matrix.inverse());
                        drag.current = {
                          role,
                          offset: [
                            point.x - placement.at[0],
                            point.y + placement.at[1],
                          ],
                        };
                        setSelected(role);
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                    >
                      <circle
                        r="1"
                        fill={
                          selected === role
                            ? theme.colors.accent
                            : theme.colors.textDark
                        }
                      />
                      {info[role]?.pads.map((pad, index) => (
                        <polygon
                          key={index}
                          points={padOutline(pad)
                            .map((point) => point.join(','))
                            .join(' ')}
                          fill="none"
                          stroke={
                            selected === role
                              ? theme.colors.accent
                              : theme.colors.text
                          }
                          strokeWidth="0.15"
                        />
                      ))}
                      {info[role]?.graphics.map((graphic, index) => (
                        <polyline
                          key={`graphic${index}`}
                          points={graphicPoints(graphic)
                            .map((point) => point.join(','))
                            .join(' ')}
                          fill="none"
                          stroke={theme.colors.textDark}
                          strokeWidth="0.1"
                        />
                      ))}
                      <text y="-2" fontSize="1.5" fill={theme.colors.text}>
                        {role}
                      </text>
                    </g>
                  );
                }
              )}
            </svg>
          ) : (
            <svg
              role="img"
              aria-label="Initial layout preview"
              viewBox={`-15 -15 ${((setup.columns + 2) * setup.pitch) / zoom} ${((setup.rows + 2) * setup.pitch) / zoom}`}
            >
              {Array.from(
                { length: Math.min(400, setup.columns * setup.rows) },
                (_, index) => (
                  <rect
                    key={index}
                    x={Math.floor(index / setup.rows) * setup.pitch - 9}
                    y={(index % setup.rows) * setup.pitch - 9}
                    width="18"
                    height="18"
                    rx="1"
                    fill="none"
                    stroke={theme.colors.accent}
                    strokeWidth="0.4"
                  />
                )
              )}
              {Array.from(
                { length: Math.max(0, Math.min(20, setup.thumbs)) },
                (_, index) => (
                  <rect
                    key={`thumb${index}`}
                    x={index * setup.pitch - 9}
                    y={setup.rows * setup.pitch - 9}
                    width="18"
                    height="18"
                    fill="none"
                    stroke={theme.colors.text}
                    strokeWidth="0.4"
                  />
                )
              )}
            </svg>
          )}
          <p>
            {assembly
              ? 'Drag components. Placement snaps to 0.25 mm. Plate and keycap stay fixed.'
              : 'Choose a section to configure the board. All settings remain editable.'}
          </p>
        </main>
        <aside aria-label="Setup inspector">
          <h2>{section}</h2>
          {section === 'Layout' && (
            <>
              <label>
                Name
                <input
                  value={setup.name}
                  onChange={(event) => update('name', event.target.value)}
                />
              </label>
              {number('columns', 'Columns', 1, 20)}
              {number('rows', 'Rows', 1, 20)}
              {number('thumbs', 'Thumb keys', 0, setup.columns)}
              {number('pitch', 'Spacing (mm)', 14, 30)}
              {option('topology', 'Board topology', [
                ['single', 'Single board'],
                ['mirrored', 'Separate mirrored boards'],
                ['reversible', 'One reversible PCB'],
              ])}
            </>
          )}
          {assembly && (
            <>
              {!embedded &&
                option('family', 'Switch family', [
                  ['mx', 'Cherry MX'],
                  ['choc_v1', 'Kailh Choc V1'],
                  ['choc_v2', 'Kailh Choc V2'],
                ])}
              {option('mounting', 'Switch mounting', [
                ['solder', 'Soldered'],
                ['hotswap', 'Hotswap'],
              ])}
              {toggle('diode', 'SOD-123 diode')}
              {toggle('led', 'SK6812 MINI-E LED')}
              <label>
                Selected component
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value as Role)}
                >
                  {ROLES.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              {([0, 1] as const).map((axis) => (
                <label key={axis}>
                  {axis === 0 ? 'X offset' : 'Y offset'}
                  <input
                    type="number"
                    step="0.25"
                    value={setup.template[selected].at[axis]}
                    onChange={(event) => {
                      const at = [...setup.template[selected].at] as [
                        number,
                        number,
                      ];
                      at[axis] = Number(event.target.value);
                      move(selected, { at });
                    }}
                  />
                </label>
              ))}
              <label>
                Rotation
                <input
                  type="number"
                  value={setup.template[selected].rotate}
                  onChange={(event) =>
                    move(selected, { rotate: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                PCB side
                <select
                  value={setup.template[selected].side}
                  onChange={(event) =>
                    move(selected, { side: event.target.value as 'F' | 'B' })
                  }
                >
                  <option value="F">Front</option>
                  <option value="B">Back</option>
                </select>
              </label>
              <button
                onClick={() =>
                  move(selected, defaultSetup().template[selected])
                }
              >
                Reset placement
              </button>
              <label>
                Template name
                <input
                  value={setup.template.name}
                  onChange={(event) =>
                    update('template', {
                      ...setup.template,
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <button
                onClick={() => {
                  try {
                    update(
                      'template',
                      saveTemplate({
                        ...setup.template,
                        options: {
                          family: setup.family,
                          mounting: setup.mounting,
                          diode: setup.diode,
                          led: setup.led,
                        },
                      })
                    );
                  } catch (reason) {
                    setError(String(reason));
                  }
                }}
              >
                Save template
              </button>
              <label>
                Load template
                <select
                  value=""
                  onChange={(event) => {
                    try {
                      const template = loadTemplates().find(
                        (item) => item.name === event.target.value
                      );
                      if (template) {
                        setSetup((before) => ({
                          ...before,
                          ...template.options,
                          template,
                        }));
                      }
                    } catch (reason) {
                      setError(String(reason));
                    }
                  }}
                >
                  <option value="">Choose saved template</option>
                  {(() => {
                    try {
                      return loadTemplates().map((item) => (
                        <option key={item.name}>{item.name}</option>
                      ));
                    } catch {
                      return [];
                    }
                  })()}
                </select>
              </label>
            </>
          )}
          {section === 'Controller and power' && (
            <>
              {option('connection', 'Connection', [
                ['wired', 'Wired'],
                ['wireless', 'Wireless'],
              ])}
              {option('controller', 'Controller', [
                ['', 'Choose controller'],
                ...CONTROLLERS.map(
                  (item) => [item.id, item.name] as [string, string]
                ),
              ])}
              <p>{setupNets(setup).length} GPIO required</p>
              {setup.controller === 'nice_nano' && (
                <p>
                  Model: Joe Scotto / infused-kim · CC BY-NC-SA 4.0
                  (noncommercial). Verify socket height.
                </p>
              )}
              {setup.topology !== 'single' &&
                setup.connection === 'wired' &&
                option('link', 'Split cable', [
                  ['trrs', 'TRRS serial'],
                  ['usbc', 'USB-C split link'],
                  ['rj45', 'RJ45 serial cable'],
                ])}
            </>
          )}
          {section === 'Accessories' && (
            <>
              {toggle('encoder', 'EC11 rotary encoder')}
              {toggle('reset', 'Reset switch')}
              <p>
                Power components follow the selected controller and connection.
              </p>
            </>
          )}
          {section === 'Review' && (
            <>
              {findings.length ? (
                <ul>
                  {findings.map((finding) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
              ) : (
                <p>Setup choices resolved.</p>
              )}
              <p>
                Creating a draft preserves incomplete choices. Routing and
                firmware are separate.
              </p>
            </>
          )}
        </aside>
      </Body>
    </Workspace>
  );
}
