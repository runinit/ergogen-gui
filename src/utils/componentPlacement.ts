import { initBoardOutlines } from './boardOutlines';
import { parse } from 'yaml';
import { compileSetup, CONTROLLERS, type DesignSetup } from './designSetup';
import { setupFromSource } from './boardDefaults';
import { readStudio, setValue, type StudioItem } from './studioSource';
import { syncControllerNets } from './assemblyNets';

export const COMPONENT_CHOICES = [
  ...CONTROLLERS.map((item) => ({ id: item.id, label: item.name })),
  { id: 'encoder', label: 'EC11 / EC12 encoder' },
  { id: 'reset', label: 'Reset switch' },
  { id: 'battery_connector', label: 'JST PH battery connector' },
  { id: 'battery', label: 'Battery envelope' },
  { id: 'connector', label: 'Split connector' },
  { id: 'custom', label: 'Custom component' },
];

export function insertComponent(
  source: string,
  id: string,
  choice: string,
  battery?: number[],
  targetBoard?: string
): string {
  const data = readStudio(source),
    board = targetBoard || Object.keys(data.pcbs || {})[0];
  if (!board) {
    throw new Error('Create a board in Design setup first.');
  }
  if (data.layout.objects?.[id]) {
    throw new Error('Choose an unused component name.');
  }
  if (choice === 'battery') {
    if (
      !battery ||
      battery.length !== 3 ||
      !battery.every((value) => Number.isFinite(value) && value > 0)
    ) {
      throw new Error('Enter the measured battery width, depth, and height.');
    }
    const layer =
      Object.entries(data.layout.layers || {}).find(
        ([, item]) => item.surface === `pcb.${board}.bottom`
      )?.[0] || `${board}_bottom`;
    const next = data.layout.layers?.[layer]
      ? source
      : setValue(source, ['layout', 'layers', layer], {
          surface: `pcb.${board}.bottom`,
        });
    return setValue(next, ['layout', 'objects', id], {
      kind: 'component',
      label: id,
      pcb: board,
      layer,
      side: 'bottom',
      properties: { role: 'battery' },
      envelopes: {
        body: { size: battery.slice(0, 2), height: [-battery[2], 0] },
      },
    });
  }
  const controller = CONTROLLERS.find((item) => item.id === choice);
  const setup: DesignSetup = {
    ...setupFromSource(source),
    columns: 1,
    rows: 1,
    thumbs: 0,
    topology: 'single' as const,
    controller: controller?.id || '',
    encoder: choice === 'encoder',
    reset: choice === 'reset',
    connection:
      choice === 'battery_connector'
        ? ('wireless' as const)
        : ('wired' as const),
  };
  const sample = parse(compileSetup(setup));
  const role = controller ? 'controller' : choice;
  const entry = Object.entries(sample.layout.objects).find(
    ([key]) =>
      key === role ||
      key.endsWith(`_${role}`) ||
      (choice === 'connector' && /split/.test(key))
  );
  const connector: StudioItem = {
    kind: 'component',
    envelopes: {
      body: { size: [6.4, 14], height: [0, 6], at: [0, 5, 0] },
      pcb: { size: [9, 15] },
    },
    footprints: {
      main: {
        what: 'ceoloide/trrs_pj320a',
        params: {
          TP: 'VCC',
          SL: 'GND',
          R1: `${id}_data`,
          R2: `${id}_spare`,
          side: 'F',
        },
      },
    },
  };
  const item = choice === 'connector' ? connector : (entry?.[1] as StudioItem);
  if (!item) {
    throw new Error('Choose a catalogue component.');
  }
  const binding = item.footprints!.main as { params: Record<string, unknown> };
  if (controller) {
    for (const pin of controller.pins) {
      delete binding.params[pin];
    }
    Object.assign(binding.params, controller.power || {});
  }
  const required: string[] = choice === 'connector' ? [`${id}_data`] : [];
  if (choice === 'encoder') {
    for (const pin of ['A', 'C', 'S1']) {
      const net = `${id}_${pin}`;
      binding.params[pin] = net;
      required.push(net);
    }
  }
  const layer =
    Object.entries(data.layout.layers || {}).find(
      ([, item]) => item.surface === `pcb.${board}.top`
    )?.[0] || `${board}_top`;
  let next = data.layout.layers?.[layer]
    ? source
    : setValue(source, ['layout', 'layers', layer], {
        surface: `pcb.${board}.top`,
      });
  next = setValue(next, ['layout', 'objects', id], {
    ...item,
    pcb: board,
    layer,
    label: controller?.name || id,
    placement: { at: [0, 0, 0] },
    properties: {
      role,
      required_nets: required,
      ...(controller ? { controller: controller.id } : {}),
    },
  });
  return initBoardOutlines(syncControllerNets(next));
}
