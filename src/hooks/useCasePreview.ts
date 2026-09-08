import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [result, setResult] = useState<Results | null>(null);
  const [completed, setCompleted] = useState('');
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<CaseFinding[]>([]);
  const [pending, setPending] = useState(false);
  const owned = useRef<Worker | null>(null);
  const serial = useRef(0);
  const revision = JSON.stringify([source, injections, assets]);
  const latest = useRef(revision);
  latest.current = revision;
  const generate = useCallback(() => {
    owned.current?.terminate();
    const worker = createErgogenWorker();
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
      options: { debug: true },
    });
  }, [mode, revision]);
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
