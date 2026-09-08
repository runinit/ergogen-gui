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
