import { useFootprintLibrary } from './useFootprintLibrary';
import { libraryAssets } from '../utils/footprintLibrary';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createErgogenWorker } from '../workers/workerFactory';
import { Results } from '../types/results';

export type CaseFinding = {
  feature: string;
  code: string;
  message: string;
  severity?: string;
  action?: string;
};
const ANALYSIS_DELAY_MS = 180;
const EMPTY_ASSETS: Record<string, string> = {};

// Each explicit build owns its snapshot. A changed draft never queues a solid build.
function useCaseWorker(
  source: string,
  injections: string[][] | undefined,
  assets: Record<string, string>,
  mode: 'generate' | 'analyze'
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
  const [diagnostics, setDiagnostics] = useState<CaseFinding[]>([]);
  const [pending, setPending] = useState(false);
  const owned = useRef<Worker | null>(null);
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
    // Reuse initialized analysis modules only after completion and with identical injections.
    const reusable =
      mode === 'analyze' &&
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
    setPending(true);
    const requestId = `case-${mode}-${++serial.current}`;
    worker.onerror = (event) => {
      if (owned.current !== worker) {
        return;
      }
      settled.current = false;
      setPending(false);
      if (latest.current !== revision) {
        return;
      }
      setError(
        event.message || 'Geometry worker failed. Press Generate to retry.'
      );
    };
    worker.onmessage = ({ data }) => {
      if (
        owned.current !== worker ||
        (data.requestId && data.requestId !== requestId)
      ) {
        return;
      }
      settled.current = true;
      setPending(false);
      if (latest.current !== revision) {
        return;
      }
      if (data.type === 'success') {
        setResult(data.results);
        setCompleted(revision);
        setError('');
      } else {
        setError(data.error || 'Generation failed.');
        setDiagnostics(data.diagnostics || []);
      }
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
    },
    []
  );
  useEffect(() => {
    if (mode !== 'analyze') {
      return;
    }
    const timer = window.setTimeout(generate, ANALYSIS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [generate, mode]);
  return {
    result,
    error,
    diagnostics,
    pending,
    stale: completed !== revision,
    generate,
    cancel: () => {
      owned.current?.terminate();
      owned.current = null;
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
  assets = EMPTY_ASSETS
) {
  return useCaseWorker(source, injections, assets, 'analyze');
}
