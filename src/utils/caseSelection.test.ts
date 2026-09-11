import { expect, it } from 'vitest';
import { pickCaseFeature } from './caseSelection';

it('finds a mounting feature after the case has been tilted and lifted', () => {
  const radians = Math.PI / 6;
  const assembly = {
    parts: {},
    suggestions: [],
    placement: { origin: [0, -10, 0], angle: 30, lift: 2 },
    features: [
      {
        id: 'mounts.left',
        bounds: [
          [32, 8, 10],
          [38, 12, 14],
        ] as [number[], number[]],
      },
    ],
  };
  const point = [
    35,
    -10 + 20 * Math.cos(radians) - 12 * Math.sin(radians),
    2 + 20 * Math.sin(radians) + 12 * Math.cos(radians),
  ];
  expect(pickCaseFeature(assembly, point)).toBe('mounts.left');
  expect(pickCaseFeature(assembly, [100, 100, 100])).toBeUndefined();
});
