import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCasePreview } from './useCasePreview';

const mocks = vi.hoisted(() => ({
  worker: {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as null | ((event: { data: unknown }) => void),
    onerror: null,
  },
}));
vi.mock('../workers/workerFactory', () => ({
  createErgogenWorker: () => mocks.worker,
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

it('ignores superseded work and terminates the draft worker on close', () => {
  const injections: string[][] = [];
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'old' },
  });
  act(() => vi.advanceTimersByTime(500));
  const oldId = mocks.worker.postMessage.mock.calls[0][0].requestId;
  hook.rerender({ source: 'new' });
  act(() =>
    mocks.worker.onmessage?.({
      data: {
        type: 'success',
        requestId: oldId,
        results: { canonical: 'old' },
      },
    })
  );
  expect(hook.result.current.result).toBeNull();
  act(() => vi.advanceTimersByTime(500));
  const newId = mocks.worker.postMessage.mock.calls[1][0].requestId;
  act(() =>
    mocks.worker.onmessage?.({
      data: {
        type: 'success',
        requestId: newId,
        results: { canonical: 'new' },
      },
    })
  );
  expect(hook.result.current.result?.canonical).toBe('new');
  hook.unmount();
  expect(mocks.worker.terminate).toHaveBeenCalledOnce();
});

it('marks changed injections stale even when YAML is identical', () => {
  const hook = renderHook(
    ({ injections }) => useCasePreview('same', injections),
    { initialProps: { injections: [] as string[][] } }
  );
  act(() => vi.advanceTimersByTime(500));
  const requestId = mocks.worker.postMessage.mock.calls[0][0].requestId;
  act(() =>
    mocks.worker.onmessage?.({
      data: { type: 'success', requestId, results: {} },
    })
  );
  expect(hook.result.current.pending).toBe(false);
  hook.rerender({ injections: [['footprint', 'changed', 'source']] });
  expect(hook.result.current.pending).toBe(true);
  hook.unmount();
});

it('keeps only the latest queued draft while a generation is running', () => {
  const injections: string[][] = [];
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'one' },
  });
  act(() => vi.advanceTimersByTime(500));
  const requestId = mocks.worker.postMessage.mock.calls[0][0].requestId;
  hook.rerender({ source: 'two' });
  act(() => vi.advanceTimersByTime(500));
  hook.rerender({ source: 'three' });
  act(() => vi.advanceTimersByTime(500));
  expect(mocks.worker.postMessage).toHaveBeenCalledOnce();
  act(() =>
    mocks.worker.onmessage?.({
      data: { type: 'success', requestId, results: {} },
    })
  );
  expect(mocks.worker.postMessage.mock.calls[1][0].inputConfig).toBe('three');
  hook.unmount();
});
