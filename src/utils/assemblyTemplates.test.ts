import { beforeEach, expect, it } from 'vitest';
import { defaultSetup } from './designSetup';
import { loadTemplates, saveTemplate } from './assemblyTemplates';
beforeEach(() => localStorage.clear());
it('keeps saved revisions independent from an open project', () => {
  const original = defaultSetup().template;
  const saved = saveTemplate(original);
  original.diode.at[0] = 3;
  expect(loadTemplates()[0].diode.at[0]).toBe(0);
  saved.diode.at[0] = 2;
  expect(saveTemplate(saved).revision).toBe(2);
  expect(() => saveTemplate(original)).toThrow('changed elsewhere');
});
