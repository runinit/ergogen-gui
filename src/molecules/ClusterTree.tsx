import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import styled from 'styled-components';
import type { LayoutReport } from 'ergogen/src/native';
import type { StudioDoc, StudioItem } from '../utils/studioSource';
import {
  targets,
  sameTarget,
  selectionMode,
  type StudioSelection,
  type StudioTarget,
  type SelectionMode,
} from '../utils/studioTargets';
import { TreeButton } from './StudioStyles';
import { theme } from '../theme/theme';

const Tree = styled.div`
  button {
    min-height: ${theme.studio.treeRow};
    font-size: ${theme.fontSizes.bodySmall};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    margin: 0;
  }
  @media (pointer: coarse) {
    button {
      min-height: ${theme.studio.touchSize};
    }
  }
`;
const BranchRow = styled.div`
  display: flex;
  align-items: center;
  > button:first-child {
    min-width: 24px;
    width: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    flex-shrink: 0;
  }
  > button:last-child {
    flex: 1;
    min-width: 0;
  }
`;
const Children = styled.div`
  margin-left: ${theme.spacing.sm};
  padding-left: ${theme.spacing.xs};
  border-left: 1px solid ${theme.colors.border};
`;
const Name = styled.span`
  display: block !important;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;
function Branch({
  name,
  caption,
  active,
  selected,
  choose,
  children,
}: {
  name: string;
  caption?: string;
  active: boolean;
  selected: boolean;
  choose: (event: MouseEvent) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) {
      setOpen(true);
    }
  }, [active]);
  return (
    <div
      role="treeitem"
      aria-label={name}
      aria-expanded={open}
      aria-selected={selected}
    >
      <BranchRow>
        <button
          aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <TreeButton
          aria-label={name}
          title={name}
          aria-pressed={selected}
          onClick={choose}
        >
          <Name>{caption || name}</Name>
        </TreeButton>
      </BranchRow>
      {open && <Children role="group">{children}</Children>}
    </div>
  );
}
export default function ClusterTree({
  data,
  report,
  selection,
  choose,
}: {
  data: StudioDoc;
  report?: LayoutReport;
  selection: StudioSelection;
  choose: (
    value: StudioSelection,
    mode?: SelectionMode,
    order?: StudioTarget[]
  ) => void;
}) {
  const selected = (target: StudioTarget) =>
    targets(selection).some((item) => sameTarget(item, target));
  const keyNode = (
    [id, item]: [string, StudioItem],
    order: StudioTarget[],
    members: [string, StudioItem][]
  ) => {
    const target: StudioTarget = { section: 'objects', id };
    const owned = members.filter(([, child]) => child.properties?.owner === id);
    const name = item.label || id;
    const caption =
      item.kind === 'key' && item.cell && (!item.label || item.label === id)
        ? item.cell[1]
        : name;
    const select = (event: MouseEvent) =>
      choose(target, selectionMode(event), order);
    if (owned.length) {
      return (
        <Branch
          key={id}
          name={name}
          caption={caption}
          selected={selected(target)}
          active={owned.some(([child]) =>
            selected({ section: 'objects', id: child })
          )}
          choose={select}
        >
          {owned.map((child) =>
            keyNode(
              child,
              owned.map(([id]) => ({ section: 'objects', id })),
              []
            )
          )}
        </Branch>
      );
    }
    return (
      <TreeButton
        key={id}
        role="treeitem"
        aria-label={name}
        title={name}
        aria-selected={selected(target)}
        onClick={select}
      >
        <Name>{caption}</Name>
      </TreeButton>
    );
  };
  const clusters = Object.entries(data.layout.clusters || {});
  return (
    <Tree role="tree" aria-label="Layout clusters" aria-multiselectable="true">
      {clusters.map(([id, item]) => {
        const members: [string, StudioItem][] = item.mirror
          ? Object.entries(report?.objects || {}).filter(
              ([, key]) => key.cluster === id
            )
          : Object.entries(data.layout.objects || {}).filter(
              ([, key]) => key.cluster === id
            );
        const direct = members.filter(([, item]) => !item.properties?.owner);
        const target: StudioTarget = { section: 'clusters', id };
        const active = targets(selection).some(
          (value) =>
            sameTarget(value, target) ||
            value.cluster === id ||
            members.some(
              ([key]) => value.section === 'objects' && value.id === key
            )
        );
        const count = members.filter(([, key]) => key.kind === 'key').length;
        const name = `${item.label || id} ${count} keys${item.mirror ? ' · linked' : ''}`;
        return (
          <Branch
            key={id}
            name={name}
            active={active}
            selected={selected(target)}
            choose={(event) =>
              choose(
                target,
                selectionMode(event),
                clusters.map(([id]) => ({ section: 'clusters', id }))
              )
            }
          >
            {item.arrangement?.type === 'columns' ? (
              <>
                {item.arrangement.columns?.map((column, index) => {
                  const keys = direct.filter(
                    ([, key]) => key.cell?.[0] === column
                  );
                  const target: StudioTarget = {
                    section: 'columns',
                    cluster: id,
                    id: column,
                  };
                  return (
                    <Branch
                      key={column}
                      name={`Column ${index + 1} · ${column}`}
                      caption={column}
                      selected={selected(target)}
                      active={keys.some(([key]) =>
                        selected({ section: 'objects', id: key })
                      )}
                      choose={(event) =>
                        choose(
                          target,
                          selectionMode(event),
                          item.arrangement!.columns!.map((column) => ({
                            section: 'columns',
                            cluster: id,
                            id: column,
                          }))
                        )
                      }
                    >
                      {keys.map((key) =>
                        keyNode(
                          key,
                          keys.map(([id]) => ({ section: 'objects', id })),
                          members
                        )
                      )}
                    </Branch>
                  );
                })}
                {direct
                  .filter(([, key]) => !key.cell)
                  .map((key) =>
                    keyNode(
                      key,
                      direct.map(([id]) => ({ section: 'objects', id })),
                      members
                    )
                  )}
              </>
            ) : (
              direct.map((key) =>
                keyNode(
                  key,
                  direct.map(([id]) => ({ section: 'objects', id })),
                  members
                )
              )
            )}
          </Branch>
        );
      })}
    </Tree>
  );
}
