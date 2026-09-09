import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AssemblyTree from './AssemblyTree';

describe('Assembly navigation', () => {
  it('starts repeated placements collapsed and expands them using the keyboard', () => {
    const select = vi.fn();
    render(
      <AssemblyTree
        nodes={[
          {
            id: 'components',
            label: 'Components',
            tool: 4,
            children: [
              {
                id: 'footprint:MX',
                label: 'MX (2)',
                tool: 4,
                children: [
                  { id: 'sw1', label: 'SW1', component: 'one', tool: 4 },
                ],
              },
            ],
          },
        ]}
        selected=""
        hidden={[]}
        onSelect={select}
        onVisibility={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('treeitem', { name: 'SW1' })
    ).not.toBeInTheDocument();
    const group = screen.getByRole('treeitem', { name: 'MX (2)' });
    group.focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('treeitem', { name: 'SW1' }));
    expect(select.mock.lastCall?.[0].component).toBe('one');
  });
});

it('reveals a placement selected from the canvas', () => {
  render(
    <AssemblyTree
      nodes={[
        {
          id: 'hardware',
          label: 'Hardware',
          tool: 5,
          children: [{ id: 'gaskets.edge', label: 'edge', tool: 2 }],
        },
      ]}
      selected="gaskets.edge"
      hidden={[]}
      onSelect={vi.fn()}
      onVisibility={vi.fn()}
    />
  );
  expect(screen.getByRole('treeitem', { name: 'edge' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});
