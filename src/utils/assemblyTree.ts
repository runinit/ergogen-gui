import type { BoardInventory, CaseConfig } from '../types/case';

export type AssemblyNode = {
  id: string;
  label: string;
  count?: number;
  parts?: string[];
  tool: number;
  component?: string;
  feature?: string;
  diagnostics?: string[];
  children?: AssemblyNode[];
};
function componentPart(name: string, id: string) {
  return `${name}_components_board_${name}_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
}
export function assemblyNodes(
  name: string,
  spec: CaseConfig,
  board?: BoardInventory
): AssemblyNode[] {
  const groups = new Map<string, AssemblyNode[]>();
  for (const component of board?.components || []) {
    if (!component.populated) {
      continue;
    }
    const placements = groups.get(component.footprint) || [];
    placements.push({
      id: componentPart(name, component.id),
      label: component.reference,
      tool: 4,
      component: component.id,
      feature: `board.components.${component.id}`,
      diagnostics: [
        `components.board_${name}_${component.id.replace(/[^A-Za-z0-9_]/g, '_')}`,
        `board.models.${component.id}`,
      ],
    });
    groups.set(component.footprint, placements);
  }
  const nodes: AssemblyNode[] = [
    { id: `${name}_bottom`, label: 'Case shell', tool: 3 },
    { id: `${name}_top`, label: 'Top frame', tool: 3 },
    { id: `${name}_plate`, label: 'Plate', tool: 2 },
    { id: `${name}_pcb`, label: 'PCB', tool: 0 },
    {
      id: 'components',
      count: board?.components.filter((c) => c.populated).length || 0,
      label: `Components (${board?.components.filter((c) => c.populated).length || 0})`,
      tool: 4,
      children: Array.from(groups, ([footprint, children]) => ({
        id: `footprint:${footprint}`,
        label: `${footprint} (${children.length})`,
        count: children.length,
        tool: 4,
        component: children[0].component,
        children,
      })),
    },
    {
      id: 'hardware',
      label: 'Hardware',
      tool: 5,
      children: ['mounts', 'gaskets'].flatMap((table) =>
        Object.keys(spec[table] || {}).map((id) => ({
          id: `${table}.${id}`,
          label: id,
          tool: table === 'gaskets' ? 2 : 5,
          parts:
            table === 'gaskets'
              ? ['', '_lower', '_upper'].map(
                  (suffix) => `${name}_gasket_${id}${suffix}`
                )
              : [`${name}_screws_${id}`],
          feature: `${table}.${id}`,
        }))
      ),
    },
  ];
  if (spec.construction === 'midframe') {
    nodes.splice(2, 0, { id: `${name}_middle`, label: 'Midframe', tool: 3 });
  }
  return nodes;
}

export function findTreeNode(
  nodes: AssemblyNode[],
  key: string
): AssemblyNode | undefined {
  for (const node of nodes) {
    if (
      node.id === key ||
      node.parts?.includes(key) ||
      [node.feature, ...(node.diagnostics || [])].some(
        (path) => path && (key === path || key.startsWith(`${path}.`))
      )
    ) {
      return node;
    }
    const nested = findTreeNode(node.children || [], key);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}
export function treeParts(nodes: AssemblyNode[], key: string): string[] {
  const node = findTreeNode(nodes, key);
  if (!node?.children) {
    return node?.parts || [key];
  }
  return node.children.flatMap((child) => treeParts([child], child.id));
}
