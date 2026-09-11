import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import makerjs from 'makerjs';
import CasePlanPreview from './CasePlanPreview';

it('moves a screw when its edge offset changes', () => {
  const onEdit = vi.fn();
  render(
    <CasePlanPreview
      analysis={{
        model: new makerjs.models.Rectangle(40, 30),
        bounds: { low: [0, 0], high: [40, 30], width: 40, height: 30 },
        edges: [
          {
            id: 'bottom',
            points: [
              [0, 0],
              [40, 0],
            ],
            length: 40,
          },
        ],
        placements: [
          {
            id: 'screw',
            kind: 'mount',
            position: [10, -5],
            definition: {
              anchor: { shift: [10, -5] },
              post: 4,
              hole: 1.25,
              placement: { edge: 'bottom', offset: 5 },
            },
          },
        ],
        suggestions: [],
        findings: [],
        parameters: {},
        parts: {},
      }}
      selected="mounts.screw"
      onSelect={vi.fn()}
      onEdit={onEdit}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
    />
  );
  fireEvent.change(screen.getByLabelText('Edge offset (mm)', { exact: true }), {
    target: { value: '8' },
  });
  fireEvent.blur(screen.getByLabelText('Edge offset (mm)', { exact: true }));
  expect(onEdit).toHaveBeenCalled();
  expect(onEdit.mock.lastCall?.[1].anchor.shift).toEqual([10, -8]);
});

it('drags from the grabbed position and commits the final pointer location', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal(
    'DOMPoint',
    class {
      constructor(
        public x: number,
        public y: number
      ) {}
      matrixTransform() {
        return this;
      }
    }
  );
  const onEdit = vi.fn();
  const item = {
    id: 'pad',
    kind: 'gasket' as const,
    position: [10, -2.5],
    definition: {
      anchor: { shift: [10, -2.5] },
      size: [10, 6],
      placement: { edge: 'bottom', offset: 2.5 },
    },
  };
  render(
    <CasePlanPreview
      analysis={{
        model: new makerjs.models.Rectangle(40, 30),
        bounds: { low: [0, 0], high: [40, 30], width: 40, height: 30 },
        edges: [
          {
            id: 'bottom',
            points: [
              [0, 0],
              [40, 0],
            ],
            length: 40,
          },
        ],
        placements: [item],
        suggestions: [],
        findings: [],
        parameters: {},
        parts: {},
      }}
      selected="gaskets.pad"
      onSelect={vi.fn()}
      onEdit={onEdit}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
    />
  );
  const svg = screen.getByLabelText('Interactive mounting plan');
  Object.assign(svg, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
  fireEvent.pointerDown(screen.getByRole('button', { name: 'gasket pad' }), {
    clientX: 14,
    clientY: 2.5,
  });
  fireEvent.pointerMove(svg, { clientX: 18, clientY: 2.5 });
  fireEvent.pointerUp(svg, { clientX: 20, clientY: 2.5 });
  expect(onEdit.mock.lastCall?.[1].anchor.shift).toEqual([16, -2.5]);
  vi.unstubAllGlobals();
});

it('lets the mounting plan grow into the remaining preview height', () => {
  render(
    <CasePlanPreview
      analysis={{
        model: new makerjs.models.Rectangle(40, 30),
        bounds: { low: [0, 0], high: [40, 30], width: 40, height: 30 },
        edges: [],
        placements: [],
        suggestions: [],
        findings: [],
        parameters: {},
        parts: {},
      }}
      selected=""
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onDuplicate={vi.fn()}
    />
  );
  const plan = screen.getByLabelText('Interactive mounting plan');
  expect(getComputedStyle(plan).maxHeight).toBe('none');
  expect(getComputedStyle(plan.parentElement!).flexGrow).toBe('1');
});
