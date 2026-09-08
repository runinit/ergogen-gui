import { useEffect, useRef, useState } from 'react';
import { createErgogenWorker } from '../workers/workerFactory';
import { WorkerRequest } from '../workers/ergogen.worker.types';
import { Results } from '../types/results';

const PREVIEW_DELAY_MS = 400;

// Keep one active job and one replaceable draft; native geometry never overlaps.
export function useCasePreview(
  source: string,
  injections: string[][] | undefined
) {
  const [result, setResult] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);
  const serial = useRef(0);
  const failure = useRef('');
  const active = useRef<string | null>(null);
  const queued = useRef<WorkerRequest | null>(null);
  const dispatch = useRef<() => void>(() => {});

  useEffect(() => {
    failure.current = '';
    const owned = createErgogenWorker();
    active.current = null;
    queued.current = null;
    if (!owned) {
      failure.current =
        'This browser could not start the geometry worker. Close and reopen the designer to retry.';
      setError(failure.current);
      return;
    }
    dispatch.current = () => {
      if (failure.current || active.current || !queued.current) {
        return;
      }
      const request = queued.current;
      queued.current = null;
      active.current = request.requestId || null;
      owned.postMessage(request);
    };
    owned.onerror = (event) => {
      failure.current =
        event.message ||
        'Geometry worker failed. Close and reopen the designer to retry.';
      setError(failure.current);
    };
    owned.onmessage = (event) => {
      const { requestId, type } = event.data;
      if (!requestId && type === 'error') {
        failure.current = event.data.error;
        setError(failure.current);
        return;
      }
      if (requestId !== active.current) {
        return;
      }
      active.current = null;
      if (requestId === `case-draft-${serial.current}`) {
        if (type === 'success') {
          setResult(event.data.results);
          setPending(false);
          setError('');
        } else if (type === 'error') {
          setError(event.data.error);
        }
      }
      dispatch.current();
    };
    return () => {
      owned.onmessage = null;
      owned.onerror = null;
      owned.terminate();
      active.current = null;
      queued.current = null;
      dispatch.current = () => {};
    };
  }, [injections]);

  useEffect(() => {
    setError(failure.current);
    setPending(true);
    queued.current = null;
    const requestId = `case-draft-${++serial.current}`;
    const timer = window.setTimeout(() => {
      if (!source) {
        return;
      }
      queued.current = {
        type: 'generate',
        inputConfig: source,
        injectionInput: injections,
        requestId,
        options: { debug: true },
      };
      dispatch.current();
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [source, injections]);

  return { result, error, pending };
}
