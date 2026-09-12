import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ModelEditor from './ModelEditor';
import type { ModelBinding } from '../types/footprint';
import { useState } from 'react';

vi.mock('../utils/modelSources', () => ({
  modelUrl: (source: string) => source,
  fetchModel: async () => ({
    name: 'part.step',
    source: 'STEP',
    url: 'https://example.com/part.step',
  }),
}));
vi.mock('../utils/footprintService', () => ({
  readFootprintFiles: vi.fn(),
  prepareModel: async () => ({
    model: {
      path: '${KIPRJMOD}/models/hash/part.step',
      asset: 'hash/part.step',
      offset: [0, 0, 0],
      rotate: [0, 0, 0],
      scale: [1, 1, 1],
    },
    assets: { 'hash/part.step': 'STEP' },
  }),
}));

it('lets a model value be replaced without restoring it mid-edit', () => {
  const change = vi.fn();
  function Editor() {
    const [models, setModels] = useState<ModelBinding[]>([
      {
        path: 'part.step',
        offset: [1, 2, 3],
        rotate: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ]);
    return (
      <ModelEditor
        models={models}
        assets={{}}
        selected={0}
        onSelect={vi.fn()}
        onChange={(next) => {
          change(next);
          setModels(next);
        }}
      />
    );
  }
  render(<Editor />);
  const input = screen.getByRole('spinbutton', { name: 'Model offset X' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveValue(null);
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '-2.5' } });
  fireEvent.blur(input);
  expect(input).toHaveValue(-2.5);
  expect(change.mock.lastCall![0][0].offset).toEqual([-2.5, 2, 3]);
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: '7' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveValue(-2.5);
  expect(change).toHaveBeenCalledTimes(1);
  const scale = screen.getByRole('spinbutton', { name: 'Model scale X' });
  fireEvent.change(scale, { target: { value: '0' } });
  fireEvent.blur(scale);
  expect(scale).toHaveValue(1);
  expect(change).toHaveBeenCalledTimes(1);
});
describe('Model reference resolution', () => {
  it('resolves a missing reference in place and retains its alignment', async () => {
    const model: ModelBinding = {
      path: 'https://example.com/part.step',
      offset: [1, 2, 3],
      rotate: [0, 0, 90],
      scale: [2, 1, 1],
    };
    const change = vi.fn();
    render(
      <ModelEditor
        models={[model]}
        assets={{}}
        selected={0}
        onSelect={vi.fn()}
        onChange={change}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Resolve model reference' })
    );
    await waitFor(() => expect(change).toHaveBeenCalled());
    const models = change.mock.lastCall![0];
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      asset: 'hash/part.step',
      offset: [1, 2, 3],
      rotate: [0, 0, 90],
      scale: [2, 1, 1],
    });
  });
});

it('keeps model changes owned by the active import and discards cancelled reads', async () => {
  const { readFootprintFiles } = await import('../utils/footprintService');
  let complete!: (
    value: { name: string; source: string; kind: 'model' }[]
  ) => void;
  vi.mocked(readFootprintFiles).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );
  const change = vi.fn();
  render(
    <ModelEditor
      models={[
        {
          path: 'old.step',
          offset: [0, 0, 0],
          rotate: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ]}
      assets={{}}
      selected={0}
      onSelect={vi.fn()}
      onChange={change}
    />
  );
  fireEvent.change(screen.getByLabelText('Upload 3D models'), {
    target: { files: [new File(['STEP'], 'new.step')] },
  });
  expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Replace' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
  complete([{ name: 'new.step', source: 'STEP', kind: 'model' }]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled()
  );
  expect(change).not.toHaveBeenCalled();
});
it('rebuilds a local WRL preview without downloading its project path', async () => {
  const model: ModelBinding = {
    path: '${KIPRJMOD}/models/board.wrl',
    offset: [1, 2, 3],
    rotate: [0, 0, 90],
    scale: [1, 1, 1],
  };
  const change = vi.fn();
  const spy = vi.spyOn(
    await import('../utils/footprintService'),
    'prepareModel'
  );
  render(
    <ModelEditor
      models={[model]}
      assets={{ 'board.wrl': '#VRML V2.0 utf8' }}
      selected={0}
      onSelect={vi.fn()}
      onChange={change}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Resolve model reference' })
  );
  await waitFor(() => expect(change).toHaveBeenCalled());
  expect(spy).toHaveBeenCalledWith(
    'board.wrl',
    '#VRML V2.0 utf8',
    expect.any(AbortSignal),
    undefined
  );
  spy.mockRestore();
});
