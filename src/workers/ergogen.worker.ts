import * as ergogen from 'ergogen';
import solverWasm from '@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url';
import cadWasm from 'replicad-opencascadejs/wasm?url';
import { WorkerRequest } from './ergogen.worker.types';
import { createInjectionModule } from '../utils/injectionEvaluator';
import { attachModelMeshes } from '../utils/modelPreview';
import { loadAssets } from '../utils/caseAssets';
import footprints from '../../.generated/footprints.json';
import componentFootprints from '../catalogue/footprints.json';

// Register the pinned libraries before processing user configurations.
for (const [name, source] of Object.entries({
  ...footprints,
  ...componentFootprints,
})) {
  ergogen.inject('footprint', name, createInjectionModule(source));
}

const analysisCache = {};
console.log('<-> Ergogen worker module starting...');

/**
 * Error handler for uncaught errors in the worker.
 */
self.onerror = (error) => {
  console.error('>>> Uncaught error in Ergogen worker:', error);
  const errorMessage =
    error instanceof ErrorEvent ? error.message : String(error);
  self.postMessage({
    type: 'error',
    error: `Ergogen worker initialization or execution error: ${errorMessage}`,
  });
  return true; // Prevent default error handling
};

/**
 * Main worker message handler.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, inputConfig, injectionInput, requestId, revisions } =
    event.data || {};

  console.log(`<<< Ergogen worker request: ${type} ${requestId}`);

  if (type !== 'generate' && type !== 'analyze' && type !== 'layout') {
    console.log('>>> Unknown message type:', type);
    self.postMessage({
      type: 'error',
      error: `Unknown message type: ${type}`,
      requestId,
      revisions,
    });
    return;
  }

  const warnings: string[] = [];

  try {
    // Handle code injections if provided
    if (injectionInput && Array.isArray(injectionInput)) {
      for (const injection of injectionInput) {
        if (Array.isArray(injection) && injection.length === 3) {
          const [inj_type, inj_name, inj_text] = injection;
          try {
            const inj_value = createInjectionModule(inj_text);
            ergogen.inject(inj_type, inj_name, inj_value);
          } catch (injectionError: unknown) {
            self.postMessage({
              type: 'error',
              error:
                (injectionError as Error).message || String(injectionError),
              requestId,
              revisions,
            });
            return true;
          }
        }
      }
    }

    // Run Ergogen generation
    console.log('<-> Running Ergogen in worker');
    const assets = event.data.assets || (await loadAssets().catch(() => ({})));
    const results = await ergogen.process(
      inputConfig,
      {
        debug: true,
        analysis: type !== 'generate',
        layoutOnly: type === 'layout',
        analysisCache: type === 'analyze' ? analysisCache : undefined,
        assets,
        svg: true,
        solverWasm,
        loadSolver: () => import('@salusoft89/planegcs'),
        cadWasm,
        loadCad: () => import('replicad-opencascadejs'),
      }, // Debug option enabled to ensure `demo.dxf` is generated
      (m: string) => console.log(m) // logger
    );
    if (type === 'generate') {
      attachModelMeshes(results, assets);
    }
    console.log('>>> Ergogen finished in worker');

    // Post success message with results and warnings
    self.postMessage({
      type: 'success',
      results,
      warnings,
      requestId,
      revisions,
    });
  } catch (error: unknown) {
    console.error('>>> Ergogen encountered an error: ', error);
    const errorMessage =
      error instanceof ErrorEvent ? error.message : String(error);
    self.postMessage({
      type: 'error',
      error: errorMessage,
      diagnostics: (error as { diagnostics?: unknown }).diagnostics,
      requestId,
      revisions,
    });
  }
};

export {};
