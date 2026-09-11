import JSZip from 'jszip';
import { Results } from '../types/results';

export function writeSolids(
  folder: JSZip,
  results: Pick<Results, 'solids' | 'designs'>
): void {
  for (const [name, part] of Object.entries(results.solids || {})) {
    const path = part.reference ? 'references' : 'solids';
    folder.file(`${path}/${name}.step`, part.step);
    folder.file(`${path}/${name}.stl`, part.stl);
  }
  for (const [name, assembly] of Object.entries(
    results.designs?.assemblies || {}
  )) {
    if (!assembly.step) {
      continue;
    }
    folder.file(`solids/${name}_assembly.step`, assembly.step);
    folder.file(
      `solids/${name}_manufacturing.json`,
      JSON.stringify(assembly.manufacturing, null, 2)
    );
  }
}
