import { describe, expect, it } from 'vitest';
import { assemblyNodes } from './assemblyTree';
import type { BoardInventory } from '../types/case';

describe('Assembly tree', () => {
  it('shows declared parts before generation and groups repeated footprints with individual placements', () => {
    const board = {
      components: [
        {
          id: 'one',
          reference: 'SW1',
          footprint: 'Switch:MX',
          populated: true,
        },
        {
          id: 'two',
          reference: 'SW2',
          footprint: 'Switch:MX',
          populated: true,
        },
      ],
    } as BoardInventory;
    const nodes = assemblyNodes('case', { mounts: { left: {} } }, board);
    expect(nodes.find((node) => node.id === 'case_bottom')?.label).toBe(
      'Case shell'
    );
    const components = nodes.find((node) => node.id === 'components');
    expect(components?.children?.[0].label).toBe('Switch:MX (2)');
    expect(
      components?.children?.[0].children?.map((node) => node.component)
    ).toEqual(['one', 'two']);
    expect(
      nodes.find((node) => node.id === 'hardware')?.children?.[0].feature
    ).toBe('mounts.left');
  });
});

it('resolves group selection to every placement and matches a finding target', async () => {
  const { treeParts, findTreeNode } = await import('./assemblyTree');
  const nodes = [
    {
      id: 'footprint:MX',
      label: 'MX',
      tool: 4,
      children: [
        { id: 'a', label: 'SW1', tool: 4, feature: 'board.components.one' },
        { id: 'b', label: 'SW2', tool: 4 },
      ],
    },
  ];
  expect(treeParts(nodes, 'footprint:MX')).toEqual(['a', 'b']);
  expect(findTreeNode(nodes, 'board.components.one')?.id).toBe('a');
});

it('opens a component from native collision and nested model diagnostics', async () => {
  const { findTreeNode } = await import('./assemblyTree');
  const board = {
    components: [
      { id: 'part-one', reference: 'U1', footprint: 'test', populated: true },
    ],
  } as BoardInventory;
  const nodes = assemblyNodes('case', {}, board);
  expect(findTreeNode(nodes, 'components.board_case_part_one')?.component).toBe(
    'part-one'
  );
  expect(findTreeNode(nodes, 'board.models.part-one.0.offset')?.component).toBe(
    'part-one'
  );
});

it('links generated gasket and screw bodies to their declared repair controls', async () => {
  const { findTreeNode, treeParts } = await import('./assemblyTree');
  const nodes = assemblyNodes('case', {
    gaskets: { edge: {} },
    mounts: { closing: {} },
  });
  expect(findTreeNode(nodes, 'case_gasket_edge_lower')?.feature).toBe(
    'gaskets.edge'
  );
  expect(findTreeNode(nodes, 'case_gasket_edge_upper')?.tool).toBe(2);
  expect(findTreeNode(nodes, 'case_screws_closing')?.feature).toBe(
    'mounts.closing'
  );
  expect(treeParts(nodes, 'gaskets.edge')).toEqual([
    'case_gasket_edge',
    'case_gasket_edge_lower',
    'case_gasket_edge_upper',
  ]);
});
