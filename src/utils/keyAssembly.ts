import type { DesignSetup } from './designSetup';
export function setupModels(setup: Pick<DesignSetup, 'family' | 'mounting'>) {
  const names =
    setup.family === 'mx'
      ? ['SW_Cherry_MX_PCB.stp']
      : setup.family === 'choc_v1'
        ? ['SW_Kailh_Choc_V1.stp']
        : [];
  if (setup.mounting === 'hotswap' && setup.family !== 'choc_v2') {
    names.push(
      setup.family === 'mx'
        ? 'SW_Hotswap_Kailh_MX.stp'
        : 'SW_Hotswap_Kailh_Choc_V1.stp'
    );
  }
  return names;
}
const PCB_THICKNESS = 1.6;
const BODY_HEIGHT = { diode: 1.35, led: 1.9 };
export const SETUP_REVISION = 2;
export function assemblyParts(setup: DesignSetup) {
  const isMx = setup.family === 'mx';
  const parts: Record<string, object> = {};
  parts.key = {
    revision: '1',
    envelopes: {
      pcb: { size: [18, 18] },
      keycap: { size: isMx ? [18, 18] : [17.5, 16.5] },
      plate: { size: [14, 14] },
      body: { size: [14, 14], height: [0, isMx ? 11.6 : 5.2] },
    },
  };
  parts.diode = {
    revision: '1',
    envelopes: {
      pcb: { size: [4, 2] },
      body: { size: [2.8, 1.8], height: [0, 1.35] },
    },
  };
  parts.led = {
    revision: '1',
    envelopes: {
      pcb: { size: [5, 5] },
      body: { size: [3.2, 2.8], height: [0, 1.9] },
    },
  };
  return parts;
}
type KeyContext = {
  pcb?: string;
  cluster?: string;
  cell?: string[];
  index?: number;
  placement?: unknown;
  columnNet: string;
  rowNet: string;
  ledInput?: string;
  ledOutput?: string;
};
// Both setup and editor commands compile the same physical and electrical assembly.
export function compileKey(
  setup: DesignSetup,
  id: string,
  context: KeyContext
) {
  const objects: Record<string, Record<string, unknown>> = {};
  const isMx = setup.family === 'mx';
  const reversible = setup.topology === 'reversible';
  const { columnNet, rowNet } = context;
  const sw = setup.template.switch;
  const params = {
    from: columnNet,
    to: setup.diode ? `${id}_switch` : rowNet,
    hotswap: setup.mounting === 'hotswap',
    solder: setup.mounting === 'solder',
    reversible,
    side: sw.side,
    switch_3dmodel_filename: setupModels(setup)[0]
      ? '${KIPRJMOD}/models/' + setupModels(setup)[0]
      : '',
    hotswap_3dmodel_filename: setupModels(setup)[1]
      ? '${KIPRJMOD}/models/' + setupModels(setup)[1]
      : '',
    ...(!isMx
      ? {
          choc_v1_support: setup.family === 'choc_v1',
          choc_v2_support: setup.family === 'choc_v2',
        }
      : {}),
  };
  objects[id] = {
    kind: 'key',
    part: 'key',
    envelopes: { body: { at: [...sw.at, 0], rotate: sw.rotate } },
    pcb: context.pcb,
    cluster: context.cluster,
    ...(context.cell ? { cell: [...context.cell] } : {}),
    ...(context.index !== undefined ? { index: context.index } : {}),
    ...(context.placement ? { placement: context.placement } : {}),
    models: setupModels(setup).map((name) => ({
      path: '${KIPRJMOD}/models/' + name,
      asset: name,
      offset: [...sw.at, 0],
      rotate: [0, 0, sw.rotate],
      scale: [1, 1, 1],
    })),
    properties: {
      column_net: columnNet,
      row_net: rowNet,
      assembly_template: setup.template.name,
    },
    footprints: {
      switch: {
        what: isMx ? 'ceoloide/switch_mx' : 'ceoloide/switch_choc_v1_v2',
        params,
        placement: { at: [...sw.at, 0], rotate: sw.rotate },
      },
    },
  };
  for (const kind of ['diode', 'led'] as const) {
    if (!setup[kind]) {
      continue;
    }
    const offset = setup.template[kind];
    const input = context.ledInput || 'LED_DATA';
    const netParams =
      kind === 'diode'
        ? { from: `${id}_switch`, to: rowNet }
        : {
            P1: 'VCC',
            P2: context.ledOutput || `${id}_led_out`,
            P3: 'GND',
            P4: input,
          };
    objects[`${id}_${kind}`] = {
      kind: 'component',
      part: kind,
      cluster: context.cluster,
      ...(context.cell ? { cell: [...context.cell] } : {}),
      ...(context.index !== undefined ? { index: context.index } : {}),
      pcb: context.pcb,
      side: offset.side === 'F' ? 'top' : 'bottom',
      // Footprint side alone does not transform a native physical envelope.
      envelopes: {
        body: {
          height:
            offset.side === 'B'
              ? [-PCB_THICKNESS - BODY_HEIGHT[kind], -PCB_THICKNESS]
              : [0, BODY_HEIGHT[kind]],
        },
      },
      placement: { ref: id, at: [...offset.at, 0], rotate: offset.rotate },
      properties: { owner: id, role: kind, generated_nets: netParams },
      footprints: {
        main: {
          what:
            kind === 'diode'
              ? 'ceoloide/diode_tht_sod123'
              : 'ceoloide/led_sk6812mini-e',
          params: { ...netParams, side: offset.side, reversible },
        },
      },
    };
  }
  return objects;
}
