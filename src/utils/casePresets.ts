import { parseDocument } from 'yaml';
import preset from './jlccnc-6061-2026-09.json';
export { default as supplierPreset } from './jlccnc-6061-2026-09.json';
import { editCase } from './enclosureSource';
export const JLC_PRESET = preset.id;
export const JLC_GUIDE =
  'https://jlccnc.com/help/article/cnc-machining-design-guideline';
// Supplier capability rows: cutter diameter, recommended reach, minimum pocket radius.
const TOOLS = preset.supplier.tools;
export function cncDefaults(depth: number, part: string) {
  const [cutter, reach, radius] =
    depth <= 3
      ? [1, 3, 0.5]
      : TOOLS.find((row) => row[1] >= depth) || TOOLS.at(-1)!;
  return {
    process: 'cnc',
    material: 'Aluminium 6061',
    min_wall: part === 'plate' ? 0.8 : 2,
    cutter,
    reach,
    internal_radius: radius,
    drill: 2.5,
    setups: ['top', 'bottom'],
    supplier: JLC_PRESET,
  };
}
export function applyPreset(source: string, name: string) {
  const spec = parseDocument(source).toJS()?.designs?.assemblies?.[name] || {};
  const height = Number(spec.height) || 24,
    seam = Number(spec.seam?.z ?? spec.plate_z) || 13;
  const parts = [
    'bottom',
    'top',
    'plate',
    ...(spec.construction === 'midframe' ? ['middle'] : []),
  ];
  let result = source;
  for (const part of parts) {
    const depth =
      part === 'plate'
        ? Number(spec.plate) || 1.5
        : part === 'bottom'
          ? seam
          : height - seam;
    result = editCase(
      result,
      name,
      ['manufacturing', part],
      cncDefaults(depth, part)
    );
  }
  const radius = Math.max(
    cncDefaults(seam, 'bottom').internal_radius,
    cncDefaults(height - seam, 'top').internal_radius
  );
  result = editCase(result, name, ['internal_radius'], radius);
  return editCase(result, name, ['supplier'], JLC_PRESET);
}
