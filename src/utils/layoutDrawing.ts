import type { ResolvedObject } from 'ergogen/src/native';
export function layoutPolygon(item: ResolvedObject, side: string) {
  const envelope =
    (side === 'top' && item.kind === 'key' && item.envelopes.keycap) ||
    item.envelopes.body ||
    item.envelopes.pcb;
  if (!envelope) {
    return '';
  }
  if (side === 'side') {
    const bounds = item.bounds.body || item.bounds.pcb;
    return [
      [bounds[0][0], bounds[0][2]],
      [bounds[1][0], bounds[0][2]],
      [bounds[1][0], bounds[1][2]],
      [bounds[0][0], bounds[1][2]],
    ]
      .map(([x, z]) => `${x},${-z}`)
      .join(' ');
  }
  const size = envelope.size || [
    (envelope.radius || 1) * 2,
    (envelope.radius || 1) * 2,
  ];
  const points =
    envelope.polygon ||
    (envelope.radius
      ? Array.from({ length: 32 }, (_, i) => [
          Math.cos((i * Math.PI) / 16) * envelope.radius!,
          Math.sin((i * Math.PI) / 16) * envelope.radius!,
        ])
      : [
          [-size[0] / 2, -size[1] / 2],
          [size[0] / 2, -size[1] / 2],
          [size[0] / 2, size[1] / 2],
          [-size[0] / 2, size[1] / 2],
        ]);
  const angle = ((envelope.rotate || 0) * Math.PI) / 180;
  const matrix = item.matrix;
  return points
    .map(([x, y]) => {
      const local = [
        x * Math.cos(angle) - y * Math.sin(angle) + (envelope.at?.[0] || 0),
        x * Math.sin(angle) + y * Math.cos(angle) + (envelope.at?.[1] || 0),
        envelope.at?.[2] || 0,
      ];
      const world = [0, 1].map(
        (row) =>
          matrix[row * 4 + 3] +
          local.reduce((sum, v, i) => sum + matrix[row * 4 + i] * v, 0)
      );
      return `${world[0]},${-world[1]}`;
    })
    .join(' ');
}
