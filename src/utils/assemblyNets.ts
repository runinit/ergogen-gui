import { CONTROLLERS, setupNets, type DesignSetup } from './designSetup';
import {
  getValue,
  readStudio,
  setValue,
  type StudioItem,
} from './studioSource';

export function keyNets(source: string, id: string) {
  const data = readStudio(source),
    item = data.layout.objects![id];
  const prefix = item.pcb && item.pcb !== 'main' ? `${item.pcb}_` : '';
  const standard = item.cluster === `${prefix}fingers`;
  const peers = Object.values(data.layout.objects || {}).filter(
    (peer) => peer.kind === 'key' && peer.cluster === item.cluster
  );
  const net = (axis: 'column' | 'row', index: number) => {
    const property = `${axis}_net`;
    if (item.properties?.[property]) {
      return String(item.properties[property]);
    }
    const cell = item.cell?.[index];
    const peer =
      cell &&
      peers.find(
        (peer) => peer.cell?.[index] === cell && peer.properties?.[property]
      );
    if (peer) {
      return String(peer.properties![property]);
    }
    if (standard && cell && /^[cr]\d+$/.test(cell)) {
      return `${prefix}${cell.toUpperCase()}`;
    }
    return `${item.cluster || id}_${cell || (axis === 'row' ? 'row' : `c${(item.index || 0) + 1}`)}`;
  };
  return { columnNet: net('column', 0), rowNet: net('row', 1) };
}

// Existing assignments reserve their pins. Only missing nets use unassigned GPIOs.
export function syncControllerNets(source: string): string {
  const setup = getValue(source, ['meta', 'studio', 'setup']) as
    | DesignSetup
    | undefined;
  const controller = CONTROLLERS.find((item) => item.id === setup?.controller);
  if (!controller) {
    return source;
  }
  const data = readStudio(source);
  let result = source;
  const messages: string[] = [];
  for (const [id, item] of Object.entries(data.layout.objects || {})) {
    const binding = item.footprints?.main as
      | { what?: string; params?: Record<string, unknown> }
      | undefined;
    if (binding?.what !== controller.provider) {
      continue;
    }
    const objects = Object.values(data.layout.objects || {}).filter(
      (object) => object.pcb === item.pcb
    );
    for (const [clusterId, cluster] of Object.entries(
      data.layout.clusters || {}
    )) {
      if (!cluster.mirror) {
        continue;
      }
      const overrides =
        (getValue(source, [
          'layout',
          'clusters',
          clusterId,
          'overrides',
        ]) as Record<string, StudioItem>) || {};
      objects.push(
        ...Object.values(overrides).filter((object) => object.pcb === item.pcb)
      );
    }
    const params = { ...binding.params };
    const nets = new Set(
      objects.flatMap((object) => {
        const role = object.properties?.role;
        if (object.kind === 'key' || object.properties?.column_net) {
          return [
            object.properties?.column_net,
            object.properties?.row_net,
          ].filter((net): net is string => typeof net === 'string');
        }
        if (role === 'led') {
          return [`${item.pcb === 'main' ? '' : `${item.pcb}_`}LED_DATA`];
        }
        return [];
      })
    );
    const prefix = item.pcb === 'main' ? '' : `${item.pcb}_`;
    for (const net of setupNets(setup!, prefix).filter(
      (net) => net.includes('ENC_') || net.endsWith('SPLIT_DATA')
    )) {
      nets.add(net);
    }
    const missing = Array.from(nets).filter(
      (net) => !Object.values(params).includes(net)
    );
    const free = controller.pins.filter((pin) => !params[pin]);
    for (const net of missing) {
      const pin = free.shift();
      if (pin) {
        params[pin] = net;
      } else {
        messages.push(
          `${item.pcb}: no free GPIO for ${net}. Review controller assignments.`
        );
      }
    }
    if (JSON.stringify(params) !== JSON.stringify(binding.params)) {
      result = setValue(
        result,
        ['layout', 'objects', id, 'footprints', 'main', 'params'],
        params
      );
    }
  }
  const previous = (getValue(result, [
    'meta',
    'studio',
    'electricalFindings',
  ]) || []) as string[];
  const findings = [
    ...previous.filter((message) => !message.includes(': no free GPIO for ')),
    ...messages,
  ];
  if (JSON.stringify(previous) !== JSON.stringify(findings)) {
    result = setValue(
      result,
      ['meta', 'studio', 'electricalFindings'],
      findings
    );
  }
  return result;
}

// Setup recompilation must not shift existing pin assignments when matrix size changes.
export function keepControllerPins(before: string, source: string): string {
  const old = readStudio(before),
    next = readStudio(source);
  let result = source;
  for (const [id, item] of Object.entries(next.layout.objects || {})) {
    const binding = item.footprints?.main as
      | { what?: string; params: Record<string, unknown> }
      | undefined;
    const previous = old.layout.objects?.[id]?.footprints
      ?.main as typeof binding;
    const controller = CONTROLLERS.find(
      (controller) => controller.provider === binding?.what
    );
    if (
      !controller ||
      !binding ||
      !previous ||
      previous.what !== binding.what
    ) {
      continue;
    }
    const params = Object.fromEntries(
      Object.entries(binding.params).filter(
        ([pin]) => !controller.pins.includes(pin)
      )
    );
    for (const pin of controller.pins) {
      if (previous.params[pin] !== undefined) {
        params[pin] = previous.params[pin];
      }
    }
    result = setValue(
      result,
      ['layout', 'objects', id, 'footprints', 'main', 'params'],
      params
    );
  }
  return result;
}
