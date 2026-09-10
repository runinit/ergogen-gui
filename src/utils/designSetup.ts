import { stringify } from 'yaml';
import { setupModels } from './componentModels';

export type AssemblyPlacement = {
  at: [number, number];
  rotate: number;
  side: 'F' | 'B';
};
export type KeyAssembly = {
  options?: {
    family: DesignSetup['family'];
    mounting: DesignSetup['mounting'];
    diode: boolean;
    led: boolean;
  };
  name: string;
  revision: number;
  switch: AssemblyPlacement;
  diode: AssemblyPlacement;
  led: AssemblyPlacement;
};
export type DesignSetup = {
  name: string;
  columns: number;
  rows: number;
  thumbs: number;
  pitch: number;
  topology: 'single' | 'mirrored' | 'reversible';
  connection: 'wired' | 'wireless';
  link: 'trrs' | 'usbc' | 'rj45';
  family: 'mx' | 'choc_v1' | 'choc_v2';
  mounting: 'solder' | 'hotswap';
  diode: boolean;
  led: boolean;
  encoder: boolean;
  reset: boolean;
  controller: string;
  template: KeyAssembly;
};
const PCB_THICKNESS = 1.6;
const BODY_HEIGHT = { diode: 1.35, led: 1.9 };
const GPIO = [
  'P0',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'P7',
  'P8',
  'P9',
  'P10',
  'P14',
  'P15',
  'P16',
  'P18',
  'P19',
  'P20',
  'P21',
];
type Controller = {
  id: string;
  name: string;
  provider: string;
  wireless: boolean;
  pins: readonly string[];
  size?: [number, number];
  model?: string;
  power?: Record<string, string>;
};
export const CONTROLLERS: Controller[] = [
  {
    id: 'xiao_rp2040',
    name: 'Seeed XIAO RP2040',
    provider: 'catalogue/xiao_rp2040',
    wireless: false,
    pins: Array.from({ length: 11 }, (_, i) => `D${i}`),
    size: [17.5, 21],
    model: 'seeeduino_xiao_rp2040.step',
    power: { POWER_3V3: 'VCC', GROUND: 'GND', POWER_VBUS: 'VBUS' },
  },
  {
    id: 'pico',
    name: 'Raspberry Pi Pico RP2040',
    provider: 'catalogue/pico',
    wireless: false,
    pins: [
      ...Array.from({ length: 23 }, (_, i) => `GP${i}`),
      'GP26',
      'GP27',
      'GP28',
    ],
    size: [21, 51],
    model: 'RaspberryPi_Pico.step',
    power: {
      ...Object.fromEntries(
        [3, 8, 13, 18, 23, 28, 33, 38, 42].map((pad) => [
          `GROUND_${pad}`,
          'GND',
        ])
      ),
      POWER_3V3: 'VCC',
      POWER_VBUS: 'VBUS',
      POWER_VSYS: 'VSYS',
    },
  },
  {
    id: 'promicro',
    name: 'Pro Micro ATmega32U4',
    provider: 'promicro',
    wireless: false,
    pins: GPIO,
  },
  {
    id: 'nice_nano',
    model: 'Nice_Nano_V2.step',
    name: 'nice!nano v2',
    provider: 'ceoloide/mcu_nice_nano',
    wireless: true,
    pins: GPIO,
  },
  {
    id: 'supermini',
    name: 'SuperMini nRF52840',
    provider: 'ceoloide/mcu_supermini_nrf52840',
    wireless: true,
    pins: GPIO,
  },
];
export function defaultSetup(): DesignSetup {
  return {
    name: 'Keyboard',
    columns: 5,
    rows: 4,
    thumbs: 0,
    pitch: 19.05,
    topology: 'single',
    connection: 'wired',
    link: 'trrs',
    family: 'mx',
    mounting: 'solder',
    diode: true,
    led: false,
    encoder: false,
    reset: false,
    controller: '',
    template: {
      name: 'Default key assembly',
      revision: 1,
      switch: { at: [0, 0], rotate: 0, side: 'B' },
      diode: { at: [0, -5], rotate: 0, side: 'B' },
      led: { at: [0, 5], rotate: 0, side: 'B' },
    },
  };
}
export function setupNets(setup: DesignSetup, prefix = '') {
  return [
    ...Array.from({ length: setup.columns }, (_, i) => `${prefix}C${i + 1}`),
    ...Array.from(
      { length: setup.rows + (setup.thumbs ? 1 : 0) },
      (_, i) => `${prefix}R${i + 1}`
    ),
    ...(setup.led ? [`${prefix}LED_DATA`] : []),
    ...(setup.encoder
      ? [`${prefix}ENC_A`, `${prefix}ENC_B`, `${prefix}ENC_SW`]
      : []),
    ...(setup.topology !== 'single' && setup.connection === 'wired'
      ? [`${prefix}SPLIT_DATA`]
      : []),
  ];
}
export function setupFindings(setup: DesignSetup): string[] {
  const findings: string[] = [
    'Component model alignment and physical envelopes require verification before PCB export.',
  ];
  const controller = CONTROLLERS.find((item) => item.id === setup.controller);
  if (!controller) {
    findings.push('Choose a controller before PCB review.');
  }
  if (controller && setup.connection === 'wireless' && !controller.wireless) {
    findings.push('This controller has no wireless radio.');
  }
  if (
    setup.topology === 'reversible' &&
    ['promicro', 'pico', 'xiao_rp2040'].includes(setup.controller)
  ) {
    findings.push('Select a controller with a reversible footprint.');
  }
  if (controller && setupNets(setup).length > controller.pins.length) {
    findings.push(
      `GPIO shortage: ${setupNets(setup).length} required, ${controller.pins.length} available.`
    );
  }
  if (setup.topology !== 'single' && setup.connection === 'wired') {
    findings.push(
      `${setup.link.toUpperCase()} split connector mapping requires verification before PCB export.`
    );
  }
  if (setup.led) {
    findings.push(
      'Verify LED supply voltage and data-level compatibility before PCB export.'
    );
  }
  if (setup.connection === 'wireless') {
    findings.push(
      'Confirm battery, charging and power-switch wiring before PCB export.'
    );
  }
  if (setup.topology === 'reversible') {
    findings.push(
      'Confirm mirrored component population and jumper configuration before PCB export.'
    );
  }
  return findings;
}

// Compile once from structured state; do not repeatedly parse YAML while building matrices.
export function compileSetup(setup: DesignSetup): string {
  setup = {
    ...setup,
    template: {
      ...setup.template,
      options: {
        family: setup.family,
        mounting: setup.mounting,
        diode: setup.diode,
        led: setup.led,
      },
    },
  };
  if (
    ![setup.columns, setup.rows].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 20
    ) ||
    !Number.isInteger(setup.thumbs) ||
    setup.thumbs < 0 ||
    setup.thumbs > setup.columns ||
    !Number.isFinite(setup.pitch) ||
    setup.pitch < 14
  ) {
    throw new Error(
      'Use 1–20 rows/columns, thumbs no greater than columns, and spacing of at least 14 mm.'
    );
  }
  const objects: Record<string, Record<string, unknown>> = {};
  const clusters: Record<string, object> = {};
  const layers: Record<string, object> = {};
  const regions: Record<string, object> = {};
  const boundaries: Record<string, object> = {};
  const profiles: Record<string, object> = {};
  const pcbs: Record<string, object> = {};
  const parts: Record<string, object> = {};
  const reversible = setup.topology === 'reversible';
  const isMx = setup.family === 'mx';
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
  const boards = setup.topology === 'mirrored' ? ['left', 'right'] : ['main'];
  for (const [boardIndex, board] of Array.from(boards.entries())) {
    const prefix = boards.length > 1 ? `${board}_` : '';
    const mirrored = boardIndex === 1;
    layers[board] = { surface: `pcb.${board}.top` };
    const cluster = `${prefix}fingers`;
    clusters[cluster] = {
      label: `${prefix}fingers`,
      layer: board,
      arrangement: {
        type: 'columns',
        columns: Array.from(
          { length: setup.columns },
          (_, i) => `c${mirrored ? setup.columns - i : i + 1}`
        ),
        rows: Array.from({ length: setup.rows }, (_, i) => `r${i + 1}`),
        pitch: [setup.pitch, setup.pitch],
      },
      ...(mirrored
        ? { placement: { at: [(setup.columns * 2 + 3) * setup.pitch, 0, 0] } }
        : {}),
    };
    if (setup.thumbs) {
      clusters[`${prefix}thumbs`] = {
        layer: board,
        arrangement: { type: 'free' },
      };
    }
    let ledIndex = 0;
    const key = (id: string, column: number, row: number, thumb = false) => {
      const columnNet = `${prefix}C${column + 1}`,
        rowNet = `${prefix}R${row + 1}`;
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
        pcb: board,
        cluster: thumb ? `${prefix}thumbs` : cluster,
        ...(thumb
          ? {
              placement: {
                at: [column * setup.pitch, -setup.pitch, 0],
                rotate: -15,
              },
            }
          : { cell: [`c${column + 1}`, `r${row + 1}`] }),
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
        const input =
          ledIndex === 0 ? `${prefix}LED_DATA` : `${prefix}LED_${ledIndex}`;
        const netParams =
          kind === 'diode'
            ? { from: `${id}_switch`, to: rowNet }
            : {
                P1: 'VCC',
                P2: input,
                P3: 'GND',
                P4: `${prefix}LED_${++ledIndex}`,
              };
        objects[`${id}_${kind}`] = {
          kind: 'component',
          part: kind,
          cluster: thumb ? `${prefix}thumbs` : cluster,
          ...(!thumb ? { cell: [`c${column + 1}`, `r${row + 1}`] } : {}),
          pcb: board,
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
          properties: { owner: id, role: kind },
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
    };
    for (let c = 0; c < setup.columns; c++) {
      for (let r = 0; r < setup.rows; r++) {
        key(`${cluster}_c${c + 1}_r${r + 1}`, c, r);
      }
    }
    for (let t = 0; t < setup.thumbs; t++) {
      key(`${prefix}thumb_${t + 1}`, t, setup.rows, true);
    }
    const controller = CONTROLLERS.find((item) => item.id === setup.controller);
    if (controller) {
      const params: Record<string, unknown> =
        controller.id === 'promicro'
          ? { orientation: 'up' }
          : controller.provider.startsWith('catalogue/')
            ? {}
            : { reversible, side: 'F' };
      Object.assign(params, controller.power || {});
      if (controller.id === 'nice_nano') {
        params.mcu_3dmodel_filename = '${KIPRJMOD}/models/' + controller.model;
      }
      setupNets(setup, prefix).forEach((net, index) => {
        if (controller.pins[index]) {
          params[controller.pins[index]] = net;
        }
      });
      objects[`${prefix}controller`] = {
        models: controller.model
          ? [
              {
                path: '${KIPRJMOD}/models/' + controller.model,
                asset: controller.model,
                offset: [0, 0, 0],
                rotate: [0, 0, 0],
                scale: [1, 1, 1],
              },
            ]
          : [],
        kind: 'component',
        pcb: board,
        layer: board,
        placement: {
          at: [
            (mirrored ? setup.columns + 2 : setup.columns) * setup.pitch,
            setup.pitch,
            0,
          ],
        },
        envelopes: {
          pcb: { size: controller.size || [18, 34] },
          body: { size: controller.size || [18, 34], height: [0, 5] },
        },
        footprints: {
          main: {
            what: controller.provider,
            params,
            ...(controller.id === 'promicro'
              ? { placement: { rotate: 90 } }
              : {}),
          },
        },
      };
    }
    const bridges: Record<string, object> = {};
    const anchor = `${cluster}_c${setup.columns}_r${Math.min(2, setup.rows)}`;
    if (controller) {
      bridges.controller = {
        from: {
          ref: mirrored
            ? `right_fingers__${anchor.replace(/^right_/, 'left_')}`
            : anchor,
        },
        to: { ref: `${prefix}controller` },
        width: 10,
      };
    }
    const accessory = (
      id: string,
      provider: string,
      size: number[],
      height: number,
      params: object,
      index: number
    ) => {
      const name = `${prefix}${id}`;
      objects[name] = {
        kind: 'component',
        pcb: board,
        layer: board,
        placement: {
          at: [
            (mirrored ? setup.columns + 2 : setup.columns) * setup.pitch,
            (index + 2.5) * setup.pitch,
            0,
          ],
        },
        envelopes: { pcb: { size }, body: { size, height: [0, height] } },
        footprints: {
          main: {
            what: provider,
            params: { ...params, reversible, side: 'F' },
          },
        },
      };
      bridges[id] = {
        from: { ref: controller ? `${prefix}controller` : anchor },
        to: { ref: name },
        width: 8,
      };
    };
    if (setup.encoder) {
      accessory(
        'encoder',
        'ceoloide/rotary_encoder_ec11_ec12',
        [15, 17],
        20,
        {
          A: `${prefix}ENC_A`,
          B: 'GND',
          C: `${prefix}ENC_B`,
          S1: `${prefix}ENC_SW`,
          S2: 'GND',
        },
        0
      );
    }
    if (setup.reset) {
      accessory(
        'reset',
        'ceoloide/reset_switch_smd_side',
        [7, 4],
        3,
        { from: 'GND', to: 'RST' },
        1
      );
    }
    if (setup.connection === 'wireless') {
      accessory(
        'battery_connector',
        'ceoloide/battery_connector_jst_ph_2',
        [8, 8],
        6,
        { BAT_P: 'BAT_P', BAT_N: 'GND' },
        2
      );
      accessory(
        'power_switch',
        'ceoloide/power_switch_smd_side',
        [8, 4],
        3,
        { from: 'BAT_P', to: 'RAW' },
        3
      );
    }
    regions[board] = {
      select: { pcb: board, kind: 'key' },
      envelope: 'pcb',
      close: 2,
    };
    const hasComponents = Object.values(objects).some(
      (item) => item.pcb === board && item.kind === 'component'
    );
    if (hasComponents) {
      regions[`${board}_components`] = {
        select: { pcb: board, kind: 'component' },
        envelope: 'pcb',
      };
    }
    boundaries[board] = {
      from: [
        `regions.${board}`,
        ...(hasComponents ? [`regions.${board}_components`] : []),
      ],
      bridges,
      clearance: 2,
      connected: 'single',
      corners: { fillet: 2 },
    };
    profiles[board] = { from: `boundaries.${board}` };
    pcbs[board] = { profile: `profiles.${board}`, thickness: PCB_THICKNESS };
  }
  // Native mirrors keep both halves linked to edits of the source clusters.
  if (setup.topology === 'mirrored') {
    for (const group of ['fingers', ...(setup.thumbs ? ['thumbs'] : [])]) {
      const overrides: Record<string, object> = {};
      for (const [id, original] of Object.entries(objects)) {
        if (original.cluster !== `left_${group}`) {
          continue;
        }
        const rightId = id.replace(/^left_/, 'right_');
        const copy = objects[rightId];
        if (!copy) {
          continue;
        }
        const properties = { ...(copy.properties as Record<string, unknown>) };
        if (typeof properties.owner === 'string') {
          properties.owner = `right_${group}__${properties.owner.replace(/^right_/, 'left_')}`;
        }
        overrides[id] = {
          pcb: 'right',
          properties,
          footprints: copy.footprints,
          layer: 'right',
        };
        delete objects[rightId];
      }
      clusters[`right_${group}`] = {
        mirror: {
          source: `left_${group}`,
          axis: (setup.columns + 1) * setup.pitch,
        },
        layer: 'right',
        overrides,
      };
    }
  }
  const source = stringify(
    {
      schema: 'ergogen/v1',
      meta: {
        name: setup.name,
        studio: {
          bridges: Object.fromEntries(
            Object.entries(boundaries).map(([id, boundary]) => [
              id,
              Object.keys((boundary as { bridges?: object }).bridges || {}),
            ])
          ),
          setup: structuredClone(setup),
          findings: setupFindings(setup),
          templates: { [setup.template.name]: setup.template },
        },
      },
      parts,
      layout: { objects, clusters, layers },
      designs: { regions, boundaries, profiles },
      pcbs,
    },
    { lineWidth: 100 }
  );
  return source;
}
