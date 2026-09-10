import { findAsset, type CaseAssets } from './caseAssets';
import type { ModelBinding } from '../types/footprint';

// Imported PCB bindings may retain a path without the library's asset identifier.
export function modelPreview(
  model: Pick<ModelBinding, 'path' | 'asset'>,
  assets: CaseAssets
) {
  const cached = model.asset && assets[`__model_${model.asset}.json`];
  if (cached) {
    return cached;
  }
  try {
    const asset = findAsset(model.asset || model.path, assets);
    return asset ? assets[`__model_${asset}.json`] : undefined;
  } catch {
    // Ambiguous paths remain unresolved; the editor offers an explicit repair.
    return undefined;
  }
}
