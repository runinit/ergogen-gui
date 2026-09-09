import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ModelEditor from './ModelEditor';
import type { ModelBinding } from '../types/footprint';

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
