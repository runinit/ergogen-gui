import type { ModelBinding } from '../types/footprint';
import { encodeAsset } from './caseAssets';
const cache = new Map<
  string,
  Promise<{ model: ModelBinding; assets: Record<string, string> }>
>();
export { setupModels } from './keyAssembly';
export function loadComponentModel(name: string) {
  let pending = cache.get(name);
  if (!pending) {
    pending = (async () => {
      const base = `${import.meta.env.BASE_URL}components/`;
      const [step, stl] = await Promise.all([
        fetch(base + name),
        fetch(base + name + '.stl'),
      ]);
      if (!step.ok || !stl.ok) {
        throw new Error(`Cannot load bundled model ${name}.`);
      }
      const source = await step.text();
      const mesh = encodeAsset(new Uint8Array(await stl.arrayBuffer()));
      const model: ModelBinding = {
        path: '${KIPRJMOD}/models/' + name,
        asset: name,
        offset: [0, 0, 0],
        rotate: [0, 0, 0],
        scale: [1, 1, 1],
      };
      return {
        model,
        assets: {
          [name]: source,
          [`__model_${name}.json`]: JSON.stringify({ stl: mesh }),
        },
      };
    })();
    cache.set(name, pending);
    void pending.catch(() => cache.delete(name));
  }
  return pending;
}
