import { useFootprintLibrary } from './useFootprintLibrary';
import { libraryAssets } from '../utils/footprintLibrary';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createErgogenWorker,
  createJscadWorker,
} from '../workers/workerFactory';
import { Results } from '../types/results';

export type CaseFinding = {
  feature: string;
  code: string;
  message: string;
  severity?: string;
  action?: string;
};
export type GeometryJob = ReturnType<typeof useCaseWorker>;
const ANALYSIS_DELAY_MS = 180;
const EMPTY_ASSETS: Record<string, string> = {};

// Each explicit build owns its snapshot. A changed draft never queues a solid build.
function useCaseWorker(
  source: string,
  injections: string[][] | undefined,
  assets: Record<string, string>,
  mode: 'generate' | 'analyze' | 'layout',
  enabled = true
) {
  const { entries } = useFootprintLibrary();
  const mergedAssets = useMemo(
    () => ({ ...libraryAssets(injections, entries), ...assets }),
    [injections, entries, assets]
  );
  const libraryRevision = JSON.stringify(
    entries.map((entry) => [entry.id, entry.revision])
  );
  const [result, setResult] = useState<Results | null>(null);
  const [completed, setCompleted] = useState('');
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState('');
  const [diagnostics, setDiagnostics] = useState<CaseFinding[]>([]);
  const [pending, setPending] = useState(false);
  const owned = useRef<Worker | null>(null);
  const conversion = useRef<Worker | null>(null);
  const runningRevision = useRef('');
  const serial = useRef(0);
  const settled = useRef(false);
  const workerInjections = useRef('');
  const injectionRevision = JSON.stringify(injections);
  const revision = useMemo(
    () => JSON.stringify([source, injections, mergedAssets, libraryRevision]),
    [source, injections, mergedAssets, libraryRevision]
  );
  const latest = useRef(revision);
  latest.current = revision;
  const generate = useCallback(() => {
    setAttempted(revision);
    conversion.current?.terminate();
    conversion.current = null;
    // Completed workers retain WASM modules; busy or changed-injection workers are replaced.
    const reusable =
      owned.current &&
      settled.current &&
      workerInjections.current === injectionRevision;
    if (!reusable) {
      owned.current?.terminate();
    }
    const worker = reusable ? owned.current : createErgogenWorker();
    settled.current = false;
    workerInjections.current = injectionRevision;
    owned.current = worker;
    setError('');
    setDiagnostics([]);
    setCompleted('');
    if (!worker) {
      setError(
        'This browser could not start the geometry worker. Press Generate to retry.'
      );
      setPending(false);
      return;
    }
    runningRevision.current = revision;
    setPending(true);
    const requestId = `case-${mode}-${++serial.current}`;
    worker.onerror = (event) => {
      if (owned.current !== worker) {
        return;
      }
      settled.current = false;
      runningRevision.current = '';
      setPending(false);
      if (latest.current !== revision) {
        return;
      }
      setError(
        event.message || 'Geometry worker failed. Press Generate to retry.'
      );
    };
    const finish = (data: {
      type: string;
      results?: Results;
      error?: string;
      diagnostics?: CaseFinding[];
    }) => {
      runningRevision.current = '';
      setPending(false);
      if (latest.current !== revision) {
        return;
      }
      if (data.type === 'success' && data.results) {
        setResult(data.results);
        setCompleted(revision);
        setError('');
      } else {
        setError(data.error || 'Generation failed.');
        setDiagnostics(data.diagnostics || []);
      }
    };
    worker.onmessage = ({ data }) => {
      if (
        owned.current !== worker ||
        (data.requestId && data.requestId !== requestId)
      ) {
        return;
      }
      settled.current = data.type === 'success';
      const needsStl = Object.values(
        (data.results as Results | undefined)?.cases || {}
      ).some((part) => part.jscad && !part.stl);
      if (
        latest.current !== revision ||
        data.type !== 'success' ||
        mode !== 'generate' ||
        !needsStl
      ) {
        finish(data);
        return;
      }
      // Tray presets emit JSCAD; finish their meshes within the same build.
      const converter = createJscadWorker();
      conversion.current = converter;
      if (!converter) {
        finish({
          type: 'error',
          error: 'Could not start STL conversion. Press Generate to retry.',
        });
        return;
      }
      converter.onmessage = ({ data }) => {
        if (conversion.current !== converter) {
          return;
        }
        converter.terminate();
        conversion.current = null;
        finish(data);
      };
      converter.onerror = (event) => {
        if (conversion.current !== converter) {
          return;
        }
        converter.terminate();
        conversion.current = null;
        finish({
          type: 'error',
          error:
            event.message || 'STL conversion failed. Press Generate to retry.',
        });
      };
      converter.postMessage({
        type: 'batch_jscad_to_stl',
        results: data.results,
        configVersion: serial.current,
      });
    };
    const [inputConfig, injectionInput, capturedAssets] = JSON.parse(revision);
    worker.postMessage({
      type: mode,
      inputConfig,
      injectionInput,
      assets: capturedAssets,
      requestId,
      revisions: {
        source: inputConfig,
        injection: JSON.stringify(injectionInput),
        library: libraryRevision,
        asset: JSON.stringify(capturedAssets),
      },
      options: { debug: true },
    });
  }, [mode, revision, injectionRevision, libraryRevision]);
  useEffect(
    () => () => {
      owned.current?.terminate();
      owned.current = null;
      conversion.current?.terminate();
      conversion.current = null;
      runningRevision.current = '';
    },
    []
  );
  useEffect(() => {
    if (!runningRevision.current || runningRevision.current === revision) {
      return;
    }
    conversion.current?.terminate();
    conversion.current = null;
    owned.current?.terminate();
    owned.current = null;
    runningRevision.current = '';
    settled.current = false;
    setPending(false);
  }, [revision]);
  useEffect(() => {
    if (mode === 'generate') {
      return;
    }
    if (!enabled) {
      owned.current?.terminate();
      owned.current = null;
      runningRevision.current = '';
      settled.current = false;
      setPending(false);
      return;
    }
    const timer = window.setTimeout(generate, ANALYSIS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [generate, mode, enabled]);
  return {
    result,
    error: attempted === revision ? error : '',
    diagnostics: attempted === revision ? diagnostics : [],
    pending,
    stale: completed !== revision,
    generate,
    cancel: () => {
      conversion.current?.terminate();
      conversion.current = null;
      owned.current?.terminate();
      owned.current = null;
      runningRevision.current = '';
      settled.current = false;
      setPending(false);
    },
  };
}
export function useCasePreview(
  source: string,
  injections: string[][] | undefined,
  assets = EMPTY_ASSETS
) {
  return useCaseWorker(source, injections, assets, 'generate');
}
export function useCaseAnalysis(
  source: string,
  injections: string[][] | undefined,
  assets = EMPTY_ASSETS,
  enabled = true
) {
  return useCaseWorker(source, injections, assets, 'analyze', enabled);
}

export function useLayoutAnalysis(
  source: string,
  injections: string[][] | undefined,
  enabled = true
) {
  return useCaseWorker(source, injections, EMPTY_ASSETS, 'layout', enabled);
}
