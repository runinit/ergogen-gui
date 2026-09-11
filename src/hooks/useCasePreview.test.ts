import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCaseAnalysis, useCasePreview } from './useCasePreview';

const mocks = vi.hoisted(() => ({
  available: true,
  workers: [] as any[],
  conversions: [] as any[],
}));
vi.mock('../workers/workerFactory', () => ({
  createJscadWorker: () => {
    const worker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    mocks.conversions.push(worker);
    return worker;
  },
  createErgogenWorker: () => {
    if (!mocks.available) {
      return null;
    }
    const worker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    mocks.workers.push(worker);
    return worker;
  },
}));
beforeEach(() => {
  mocks.available = true;
  mocks.workers = [];
  mocks.conversions = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
const injections: string[][] = [];

it('finishes tray STL conversion before publishing a generated result', () => {
  const hook = renderHook(() => useCasePreview('draft', injections));
  act(() => hook.result.current.generate());
  const result = { cases: { tray: { jscad: 'function main() {}' } } };
  act(() =>
    mocks.workers[0].onmessage({ data: { type: 'success', results: result } })
  );
  expect(hook.result.current.pending).toBe(true);
  expect(hook.result.current.result).toBeNull();
  expect(mocks.conversions[0].postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'batch_jscad_to_stl', results: result })
  );
  const converted = { cases: { tray: { stl: new Uint8Array([1]) } } };
  act(() =>
    mocks.conversions[0].onmessage({
      data: { type: 'success', results: converted },
    })
  );
  expect(hook.result.current.result).toEqual(converted);
  expect(hook.result.current.stale).toBe(false);
  expect(hook.result.current.pending).toBe(false);
  expect(mocks.conversions[0].terminate).toHaveBeenCalled();
});

it('rejects late tray conversion after cancellation and retry', () => {
  const hook = renderHook(() => useCasePreview('draft', injections));
  act(() => hook.result.current.generate());
  act(() =>
    mocks.workers[0].onmessage({
      data: {
        type: 'success',
        results: { cases: { tray: { jscad: 'source' } } },
      },
    })
  );
  act(() => hook.result.current.cancel());
  expect(mocks.conversions[0].terminate).toHaveBeenCalled();
  act(() => hook.result.current.generate());
  act(() =>
    mocks.conversions[0].onmessage({
      data: { type: 'success', results: { canonical: 'old' } },
    })
  );
  expect(hook.result.current.result).toBeNull();
  expect(hook.result.current.pending).toBe(true);
});
const respond = (worker: any, type = 'success') =>
  act(() =>
    worker.onmessage({
      data: {
        type,
        requestId: worker.postMessage.mock.calls.at(-1)[0].requestId,
        results: { canonical: 'generated' },
        error: 'Invalid seam',
        diagnostics: [
          { feature: 'seam', code: 'clearance', message: 'Invalid seam' },
        ],
      },
    })
  );

it('does not generate on open or repeated edits, and captures an explicit request', () => {
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'one' },
  });
  hook.rerender({ source: 'two' });
  act(() => vi.advanceTimersByTime(1000));
  expect(mocks.workers.flatMap((w) => w.postMessage.mock.calls)).toHaveLength(
    0
  );
  act(() => hook.result.current.generate());
  expect(mocks.workers.at(-1).postMessage).toHaveBeenCalledOnce();
  expect(mocks.workers.at(-1).postMessage.mock.calls[0][0].inputConfig).toBe(
    'two'
  );
  respond(mocks.workers.at(-1));
  expect(hook.result.current.stale).toBe(false);
  hook.unmount();
});
it('keeps valid geometry but marks edits and asset changes stale', () => {
  const hook = renderHook(
    ({ source, assets }) => useCasePreview(source, injections, assets),
    { initialProps: { source: 'one', assets: {} as Record<string, string> } }
  );
  act(() => hook.result.current.generate());
  respond(mocks.workers.at(-1));
  hook.rerender({ source: 'one', assets: { model: 'changed' } });
  expect(hook.result.current.stale).toBe(true);
  expect(hook.result.current.result?.canonical).toBe('generated');
  expect(hook.result.current.pending).toBe(false);
  hook.unmount();
});
it('does not accept an older revision after editing during generation', () => {
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'old' },
  });
  act(() => hook.result.current.generate());
  hook.rerender({ source: 'new' });
  respond(mocks.workers.at(-1));
  expect(hook.result.current.stale).toBe(true);
  expect(hook.result.current.pending).toBe(false);
  expect(mocks.workers.at(-1).postMessage).toHaveBeenCalledOnce();
  hook.unmount();
});
it('cancels obsolete generation and conversion as soon as the source changes', () => {
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'old' },
  });
  act(() => hook.result.current.generate());
  const worker = mocks.workers.at(-1);
  act(() =>
    worker.onmessage({
      data: {
        type: 'success',
        results: { cases: { tray: { jscad: 'source' } } },
      },
    })
  );
  const converter = mocks.conversions.at(-1);
  expect(hook.result.current.pending).toBe(true);

  act(() => hook.rerender({ source: 'new' }));

  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(converter.terminate).toHaveBeenCalledOnce();
  expect(hook.result.current.pending).toBe(false);
  expect(hook.result.current.stale).toBe(true);
  hook.unmount();
});
it('clears running state on errors and retries without losing the source', () => {
  const hook = renderHook(() => useCasePreview('draft', injections));
  act(() => hook.result.current.generate());
  respond(mocks.workers.at(-1), 'error');
  expect(hook.result.current.pending).toBe(false);
  expect(hook.result.current.error).toContain('Invalid seam');
  expect(hook.result.current.diagnostics[0].feature).toBe('seam');
  act(() => hook.result.current.generate());
  respond(mocks.workers.at(-1));
  expect(hook.result.current.error).toBe('');
  hook.unmount();
});
it('can retry a worker startup failure and terminates workers on close', () => {
  mocks.available = false;
  const hook = renderHook(() => useCasePreview('draft', injections));
  act(() => hook.result.current.generate());
  expect(hook.result.current.error).toContain('could not start');
  expect(hook.result.current.pending).toBe(false);
  mocks.available = true;
  act(() => hook.result.current.generate());
  hook.unmount();
  expect(mocks.workers.at(-1).terminate).toHaveBeenCalled();
});

it('does not restart analysis for equivalent injection and asset objects', () => {
  const hook = renderHook(() =>
    useCaseAnalysis('draft', [], { model: 'bytes' })
  );
  act(() => vi.advanceTimersByTime(1000));
  expect(mocks.workers).toHaveLength(1);
  hook.rerender();
  act(() => vi.advanceTimersByTime(1000));
  expect(mocks.workers).toHaveLength(1);
  hook.unmount();
});

it('ignores a worker error from a previous draft revision', () => {
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'old' },
  });
  act(() => hook.result.current.generate());
  const worker = mocks.workers.at(-1);
  hook.rerender({ source: 'new' });
  act(() => worker.onerror({ message: 'Old draft failed' }));
  expect(hook.result.current.error).toBe('');
  expect(hook.result.current.pending).toBe(false);
  hook.unmount();
});

it('reuses a settled analysis worker when only draft geometry changes', () => {
  const hook = renderHook(({ source }) => useCaseAnalysis(source, injections), {
    initialProps: { source: 'one' },
  });
  act(() => vi.advanceTimersByTime(200));
  respond(mocks.workers[0]);
  hook.rerender({ source: 'two' });
  act(() => vi.advanceTimersByTime(200));
  expect(mocks.workers).toHaveLength(1);
  expect(mocks.workers[0].postMessage).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it('reuses a successful CAD worker for the next explicit build', () => {
  const hook = renderHook(({ source }) => useCasePreview(source, injections), {
    initialProps: { source: 'one' },
  });
  act(() => hook.result.current.generate());
  const worker = mocks.workers[0];
  respond(worker);
  hook.rerender({ source: 'two' });
  act(() => hook.result.current.generate());
  expect(mocks.workers).toHaveLength(1);
  expect(worker.terminate).not.toHaveBeenCalled();
  expect(worker.postMessage.mock.calls.at(-1)[0].inputConfig).toBe('two');
  respond(worker);
  expect(hook.result.current.stale).toBe(false);
  hook.unmount();
});
it('restarts a busy CAD worker and replaces it when injections change', () => {
  const hook = renderHook(
    ({ injections }) => useCasePreview('draft', injections),
    { initialProps: { injections: [] as string[][] } }
  );
  act(() => hook.result.current.generate());
  act(() => hook.result.current.generate());
  expect(mocks.workers).toHaveLength(2);
  expect(mocks.workers[0].terminate).toHaveBeenCalled();
  respond(mocks.workers[1]);
  hook.rerender({ injections: [['footprint', 'custom', 'changed']] });
  act(() => hook.result.current.generate());
  expect(mocks.workers).toHaveLength(3);
  hook.unmount();
});
it('stops unused analysis and resumes it when enabled again', () => {
  const hook = renderHook(
    ({ enabled }) => useCaseAnalysis('draft', injections, {}, enabled),
    { initialProps: { enabled: true } }
  );
  act(() => vi.advanceTimersByTime(200));
  hook.rerender({ enabled: false });
  expect(mocks.workers[0].terminate).toHaveBeenCalled();
  expect(hook.result.current.pending).toBe(false);
  act(() => vi.advanceTimersByTime(500));
  expect(mocks.workers).toHaveLength(1);
  hook.rerender({ enabled: true });
  act(() => vi.advanceTimersByTime(200));
  expect(mocks.workers).toHaveLength(2);
  hook.unmount();
});

it('does not apply a failed placement result to a new drag candidate', () => {
  const hook = renderHook(({ source }) => useCaseAnalysis(source, injections), {
    initialProps: { source: 'bad drop' },
  });
  act(() => vi.advanceTimersByTime(1000));
  respond(mocks.workers.at(-1), 'error');
  expect(hook.result.current.error).toContain('Invalid seam');
  hook.rerender({ source: 'corrected drop' });
  expect(hook.result.current.error).toBe('');
  expect(hook.result.current.diagnostics).toEqual([]);
  act(() => vi.advanceTimersByTime(1000));
  respond(mocks.workers.at(-1));
  expect(hook.result.current.stale).toBe(false);
  hook.unmount();
});
