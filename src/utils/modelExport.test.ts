import { expect, it } from 'vitest';
import { kiCadVrml } from './modelExport';
it('gives exported STL triangles a KiCad-visible material and 0.1 inch units', () => {
  const model = kiCadVrml([0, 0, 0, 2.54, 0, 0, 0, 2.54, 0]);
  expect(model).toContain('appearance Appearance { material Material');
  expect(model).toContain('point [0, 0, 0, 1, 0, 0, 0, 1, 0]');
  expect(model).toContain('coordIndex [0, 1, 2, -1]');
});
