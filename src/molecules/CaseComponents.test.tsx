import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CaseComponents from './CaseComponents';
import { BoardInventory } from '../types/case';

it('groups identical footprints and applies measured dimensions once to the group', () => {
  const onEdit = vi.fn();
  const board: BoardInventory = {
    name: 'test',
    source: '',
    model: {},
    holes: [],
    findings: [],
    thickness: 1.6,
    components: ['D1', 'D2'].map((id) => ({
      id,
      position: [0, 0],
      rotation: 0,
      reference: id,
      footprint: 'Diode:SOD123',
      side: 'bottom',
      populated: true,
      models: [],
      size: [2, 1],
      height: null,
      family: null,
    })),
  };
  render(
    <CaseComponents
      board={board}
      spec={{ board: { components: { D2: { opening: true } } } }}
      assets={{}}
      onAssets={vi.fn()}
      onEdit={onEdit}
      onConfig={vi.fn()}
    />
  );
  expect(screen.getAllByText('Diode:SOD123 · 2 placements')).toHaveLength(1);
  const field = screen.getByLabelText('D1 top above PCB face (mm)');
  fireEvent.change(field, { target: { value: '2' } });
  fireEvent.blur(field);
  expect(onEdit.mock.lastCall?.[1]).toEqual({
    D1: { height: [0, 2] },
    D2: { opening: true, height: [0, 2] },
  });
  expect(
    screen.getByText(/Missing dimensions do not block/)
  ).toBeInTheDocument();
});

it('keeps automatic model transforms specific to each footprint instance', async () => {
  const onEdit = vi.fn();
  const components = ['D1', 'D2'].map((id) => ({
    id,
    reference: id,
    footprint: 'Diode:SOD123',
    side: 'top',
    populated: true,
    models: [],
    size: null,
    height: null,
    family: null,
    position: [0, 0],
    rotation: 0,
  }));
  const board: BoardInventory = {
    name: 'test',
    source: '',
    model: {},
    holes: [],
    findings: [],
    thickness: 1.6,
    components,
  };
  const props = {
    spec: { board: {} },
    assets: {
      'part.step': 'fixture',
      '__model_part.step.json': JSON.stringify({
        source: 'fixture',
        bounds: [
          [0, 0, 0],
          [2, 2, 2],
        ],
      }),
    },
    onAssets: vi.fn(),
    onEdit,
    onConfig: vi.fn(),
    selectedId: 'D1',
  };
  const view = render(<CaseComponents {...props} board={board} />);
  view.rerender(
    <CaseComponents
      {...props}
      board={{
        ...board,
        components: components.map((c, i) => ({
          ...c,
          models: [
            {
              path: 'part.step',
              offset: [0, 0, i],
              rotate: [0, 0, 0],
              scale: [1, 1, 1],
            },
          ],
        })),
      }}
    />
  );
  await vi.waitFor(() => expect(onEdit).toHaveBeenCalled());
  expect(Object.keys(onEdit.mock.calls[0][1].models)).toEqual(['D1']);
});

it('never replaces explicit multiple model bindings during automatic asset discovery', async () => {
  const onEdit = vi.fn();
  const model = {
    path: 'part.step',
    offset: [0, 0, 0],
    rotate: [0, 0, 0],
    scale: [1, 1, 1],
  };
  const board = {
    name: 'board',
    source: '',
    model: {},
    holes: [],
    findings: [],
    thickness: 1.6,
    components: [
      {
        id: 'D1',
        reference: 'D1',
        footprint: 'Diode',
        side: 'top',
        populated: true,
        position: [0, 0],
        rotation: 0,
        family: null,
        size: null,
        height: null,
        models: [model],
      },
    ],
  } as BoardInventory;
  render(
    <CaseComponents
      board={board}
      spec={{
        board: { models: { D1: [model, { ...model, path: 'second.step' }] } },
      }}
      assets={{
        'part.step': 'fixture',
        '__model_part.step.json': JSON.stringify({
          source: 'fixture',
          bounds: [
            [0, 0, 0],
            [1, 1, 1],
          ],
        }),
      }}
      onAssets={vi.fn()}
      onEdit={onEdit}
      onConfig={vi.fn()}
    />
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(onEdit).not.toHaveBeenCalled();
});

it('uses cached library models without creating instance overrides that mask later revisions', async () => {
  const onEdit = vi.fn();
  const path = 'hash/library.step';
  const board = {
    source: 'board',
    thickness: 1.6,
    components: [
      {
        id: 'U1',
        reference: 'U1',
        footprint: 'library',
        side: 'top',
        populated: true,
        position: [0, 0],
        rotation: 0,
        models: [
          {
            path: '${KIPRJMOD}/models/' + path,
            offset: [0, 0, 0],
            rotate: [0, 0, 0],
            scale: [1, 1, 1],
          },
        ],
      },
    ],
  } as BoardInventory;
  render(
    <CaseComponents
      board={board}
      spec={{ board: { source: 'generated' } }}
      assets={{
        [path]: 'STEP',
        [`__model_${path}.json`]: JSON.stringify({
          source: 'STEP',
          bounds: [
            [0, 0, 0],
            [1, 1, 1],
          ],
        }),
      }}
      onAssets={vi.fn()}
      onEdit={onEdit}
      onConfig={vi.fn()}
    />
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(onEdit).not.toHaveBeenCalled();
  expect(screen.queryByText(/model needs import/)).not.toBeInTheDocument();
});
