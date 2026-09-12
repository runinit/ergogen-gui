import type { KeyAssembly } from './designSetup';
import { storageKey } from './storageKey';
const KEY = storageKey('key-assembly-templates-v1');
export function loadTemplates(): KeyAssembly[] {
  const entries: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(entries)) {
    throw new Error('Invalid saved assembly library.');
  }
  return structuredClone(entries);
}
export function saveTemplate(template: KeyAssembly): KeyAssembly {
  const entries = loadTemplates();
  const index = entries.findIndex((item) => item.name === template.name);
  const previous = entries[index];
  if (previous && previous.revision !== template.revision) {
    throw new Error(
      'This template changed elsewhere. Load its current revision first.'
    );
  }
  const saved = structuredClone({
    ...template,
    revision: (previous?.revision || 0) + 1,
  });
  if (index < 0) {
    entries.push(saved);
  } else {
    entries[index] = saved;
  }
  localStorage.setItem(KEY, JSON.stringify(entries));
  return saved;
}
