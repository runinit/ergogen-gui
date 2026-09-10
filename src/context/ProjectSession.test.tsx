import { act, render, waitFor } from '@testing-library/react';
import { ConfigContextProvider, useConfigContext } from './ConfigContext';

const worker = vi.hoisted(() => ({ postMessage: vi.fn(), terminate: vi.fn() }));
const assets = vi.hoisted(() => ({
  load: vi.fn(async (_id: string) => ({}) as Record<string, string>),
  save: vi.fn(async () => {}),
}));
vi.mock('../utils/caseAssets', async (original) => ({
  ...(await original<typeof import('../utils/caseAssets')>()),
  loadProjectAssets: assets.load,
  saveProjectAssets: assets.save,
}));
vi.mock('../workers/workerFactory', () => ({
  createErgogenWorker: () => worker,
  createJscadWorker: () => ({ postMessage: vi.fn(), terminate: vi.fn() }),
}));
let session: NonNullable<ReturnType<typeof useConfigContext>>;
function Capture() {
  const value = useConfigContext();
  if (value) {
    session = value;
  }
  return null;
}
const source = 'schema: ergogen/v1\nlayout: {}\n';
beforeEach(() => {
  localStorage.clear();
  assets.load.mockReset().mockResolvedValue({});
  assets.save.mockClear();
});
function mount() {
  render(
    <ConfigContextProvider>
      <Capture />
    </ConfigContextProvider>
  );
}
it('keeps imported assets when creation and import share one event', async () => {
  mount();
  let id = '';
  act(() => {
    id = session.createNewConfig(source, 'Imported');
    session.setProjectAssets({ 'board.kicad_pcb': 'PCB' });
  });
  await waitFor(() =>
    expect(session.projectAssets).toEqual({ 'board.kicad_pcb': 'PCB' })
  );
  expect(assets.save).toHaveBeenLastCalledWith(id, {
    'board.kicad_pcb': 'PCB',
  });
});
it('merges an asset edit with a pending project load', async () => {
  let resolve!: (value: Record<string, string>) => void;
  assets.load.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  mount();
  act(() => {
    session.createNewConfig(source, 'Loading');
  });
  act(() => {
    session.setProjectAssets((before) => ({ ...before, 'new.step': 'new' }));
  });
  await act(async () => {
    resolve({ 'existing.step': 'existing' });
  });
  await waitFor(() =>
    expect(session.projectAssets).toEqual({
      'existing.step': 'existing',
      'new.step': 'new',
    })
  );
});
it('undoes source, assets and custom footprints in one project history', async () => {
  mount();
  act(() => {
    session.createNewConfig(source, 'History');
  });
  await waitFor(() => expect(assets.load).toHaveBeenCalled());
  await act(async () => {});
  act(() => {
    session.setProjectAssets({ 'board.step': 'STEP' });
  });
  act(() => {
    session.setInjectionInput([['footprint', 'switch', 'custom']]);
  });
  act(() => {
    session.editSource(source + 'units: {pitch: 19}\n');
  });
  act(() => {
    session.undo();
  });
  expect(session.configInput).toBe(source);
  act(() => {
    session.undo();
  });
  expect(session.injectionInput).toEqual([]);
  act(() => {
    session.undo();
  });
  expect(session.projectAssets).toEqual({});
  act(() => {
    session.redo();
  });
  expect(session.projectAssets).toEqual({ 'board.step': 'STEP' });
});
it('copies project assets when duplicating a saved design', async () => {
  mount();
  let id = '';
  act(() => {
    id = session.createNewConfig(source, 'Original');
  });
  await act(async () => {});
  act(() => {
    session.setProjectAssets({ 'board.step': 'STEP' });
  });
  act(() => {
    session.duplicateConfig(id);
  });
  await act(async () => {});
  expect(session.projectAssets).toEqual({ 'board.step': 'STEP' });
  expect(assets.save).toHaveBeenLastCalledWith(session.activeConfigId, {
    'board.step': 'STEP',
  });
});

it('does not build native solids when Studio is closed', async () => {
  vi.useFakeTimers();
  try {
    mount();
    worker.postMessage.mockClear();
    act(() => {
      session.createNewConfig(source, 'Native');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(
      worker.postMessage.mock.calls.some(
        ([message]) => message.type === 'generate'
      )
    ).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
it('clears a previous generation error when the source changes', () => {
  mount();
  act(() => {
    session.createNewConfig(source, 'Repair');
  });
  act(() => {
    session.setError('Old geometry failed');
  });
  act(() => {
    session.editSource(source + 'units: {pitch: 19}\n');
  });
  expect(session.error).toBeNull();
});
it('releases the generate control when edits supersede a running request', async () => {
  mount();
  act(() => {
    session.createNewConfig(source, 'Generation');
  });
  await act(async () => {
    await session.generateNow(source, [], { pointsonly: false });
  });
  expect(session.isGenerating).toBe(true);
  act(() => {
    session.editSource(source + 'units: {pitch: 19}\n');
  });
  expect(session.isGenerating).toBe(false);
  expect(session.resultsStale).toBe(true);
});
it('undoes an assembly source, model and footprint update as one transaction', async () => {
  mount();
  act(() => {
    session.createNewConfig(source);
    session.setProjectAssets({ old: 'old' });
  });
  await waitFor(() => expect(session.projectAssets).toEqual({ old: 'old' }));
  const before = session.configInput;
  act(() =>
    session.commitProject({
      source: source + '# assembly\n',
      assets: { old: 'old', model: 'model' },
      injections: [['footprint', 'new', 'new']],
    })
  );
  act(() => session.undo());
  expect(session.configInput).toBe(before);
  expect(session.projectAssets).toEqual({ old: 'old' });
  expect(session.injectionInput?.some((item) => item[1] === 'new')).toBe(false);
});
it('cancels queued generation when the project session unmounts', async () => {
  vi.useFakeTimers();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const view = render(
      <ConfigContextProvider>
        <Capture />
      </ConfigContextProvider>
    );
    act(() => {
      session.createNewConfig(source, 'Queued');
      session.setAutoGen(true);
      session.setShowSettings(false);
    });
    await act(async () => {});
    view.unmount();
    error.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(error).not.toHaveBeenCalledWith(
      'Worker not available for processing request.'
    );
  } finally {
    vi.useRealTimers();
    error.mockRestore();
  }
});
