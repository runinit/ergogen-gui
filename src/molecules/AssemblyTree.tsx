import { useEffect, useState } from 'react';
import {
  Box,
  CircuitBoard,
  Layers,
  Cpu,
  Wrench,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import type { AssemblyNode } from '../utils/assemblyTree';

const Row = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  border-radius: ${theme.caseWizard.radius};
  background: ${({ $selected }) =>
    $selected ? theme.colors.accentDarker : 'transparent'};
  margin-bottom: ${theme.spacing.xs};
  && button {
    background: transparent;
    padding: ${theme.spacing.xs};
    border: 0;
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    text-align: left;
    min-width: 0;
  }
  button[role='treeitem'] {
    flex: 1;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    margin-left: auto;
    flex-shrink: 0;
  }
  svg {
    flex-shrink: 0;
  }
`;
const Group = styled.div`
  padding-left: ${theme.spacing.md};
  border-left: 1px solid ${theme.colors.border};
  margin-left: ${theme.spacing.sm};
`;
type Props = {
  nodes: AssemblyNode[];
  selected: string;
  hidden: string[];
  onSelect: (node: AssemblyNode) => void;
  onVisibility: (ids: string[]) => void;
};
export default function AssemblyTree({
  nodes,
  selected,
  hidden,
  onSelect,
  onVisibility,
}: Props) {
  const [expanded, setExpanded] = useState<string[]>(['components']);
  // Reveal ancestors when selection arrives from the canvas or a finding.
  useEffect(() => {
    const ancestors = (
      items: AssemblyNode[],
      path: string[] = []
    ): string[] => {
      for (const node of items) {
        if (node.id === selected) {
          return path;
        }
        const found = ancestors(node.children || [], [...path, node.id]);
        if (found.length) {
          return found;
        }
      }
      return [];
    };
    const parents = ancestors(nodes);
    setExpanded((previous) =>
      parents.every((id) => previous.includes(id))
        ? previous
        : Array.from(new Set([...previous, ...parents]))
    );
  }, [nodes, selected]);
  const descendants = (node: AssemblyNode): string[] => [
    node.id,
    ...(node.children?.flatMap(descendants) || []),
  ];
  const renderNodes = (nodes: AssemblyNode[], level: number) =>
    nodes.map((node) => {
      const Icon =
        node.tool === 4
          ? Cpu
          : node.tool === 5
            ? Wrench
            : node.tool === 2
              ? Layers
              : node.tool === 0
                ? CircuitBoard
                : Box;
      const open = expanded.includes(node.id);
      return (
        <div key={node.id}>
          <Row $selected={selected === node.id}>
            {node.children && (
              <button
                aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
                onClick={() =>
                  setExpanded((previous) =>
                    open
                      ? previous.filter((id) => id !== node.id)
                      : [...previous, node.id]
                  )
                }
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <button
              role="treeitem"
              aria-label={node.label}
              data-node-id={node.id}
              aria-level={level}
              aria-selected={selected === node.id}
              aria-expanded={node.children ? open : undefined}
              onClick={() => onSelect(node)}
              title={`Select ${node.label} to inspect its properties and tools.`}
            >
              <Icon size={17} />
              <span>
                {node.count === undefined
                  ? node.label
                  : node.label.replace(/ \(\d+\)$/, '')}
              </span>
              {node.count !== undefined && <small>{node.count}</small>}
            </button>
            <button
              aria-label={`${hidden.includes(node.id) ? 'Show' : 'Hide'} ${node.label}`}
              onClick={() => onVisibility(descendants(node))}
            >
              {hidden.includes(node.id) ? (
                <EyeOff size={15} />
              ) : (
                <Eye size={15} />
              )}
            </button>
          </Row>
          {node.children && open && (
            <Group role="group">{renderNodes(node.children, level + 1)}</Group>
          )}
        </div>
      );
    });
  return (
    <div
      role="tree"
      tabIndex={0}
      aria-label="Assembly"
      onKeyDown={(event) => {
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]')
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        const element = document.activeElement as HTMLElement;
        const id = element.dataset.nodeId;
        if (id && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          setExpanded((previous) =>
            event.key === 'ArrowRight'
              ? Array.from(new Set([...previous, id]))
              : previous.filter((value) => value !== id)
          );
        }
        const offset =
          event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
        if (offset) {
          event.preventDefault();
          items[
            Math.max(0, Math.min(items.length - 1, index + offset))
          ]?.focus();
        }
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
        }
      }}
    >
      {renderNodes(nodes, 1)}
    </div>
  );
}
