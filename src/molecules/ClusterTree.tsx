import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import styled from 'styled-components';
import type { LayoutReport } from 'ergogen/src/native';
import type { StudioDoc, StudioItem } from '../utils/studioSource';
import type { StudioSelection } from './StudioCanvas';
import { TreeButton } from './StudioStyles';
import { theme } from '../theme/theme';

const BranchRow = styled.div`
  display: flex;
  align-items: center;
  > button:first-child {
    padding: ${theme.spacing.xs};
    flex-shrink: 0;
  }
  > button:last-child {
    flex: 1;
    min-width: 0;
  }
`;
const Children = styled.div`
  margin-left: ${theme.spacing.md};
  padding-left: ${theme.spacing.xs};
  border-left: 1px solid ${theme.colors.border};
`;
function Branch({
  name,
  active,
  selected,
  choose,
  children,
}: {
  name: string;
  active: boolean;
  selected: boolean;
  choose: () => void;
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
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <TreeButton aria-pressed={selected} onClick={choose}>
          {name}
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
  choose: (value: StudioSelection) => void;
}) {
  const keyNode = ([id, item]: [string, StudioItem]) => (
    <TreeButton
      key={id}
      role="treeitem"
      aria-selected={selection.section === 'objects' && selection.id === id}
      onClick={() => choose({ section: 'objects', id })}
    >
      {item.label || id}
    </TreeButton>
  );
  return (
    <div role="tree" aria-label="Layout clusters">
      {Object.entries(data.layout.clusters || {}).map(([id, item]) => {
        const members: [string, StudioItem][] = item.mirror
          ? Object.entries(report?.objects || {}).filter(
              ([, key]) => key.cluster === id
            )
          : Object.entries(data.layout.objects || {}).filter(
              ([, key]) => key.cluster === id
            );
        const selected =
          selection.section === 'clusters' && selection.id === id;
        const active =
          selected ||
          selection.cluster === id ||
          members.some(
            ([key]) => selection.section === 'objects' && selection.id === key
          );
        const count = members.filter(([, key]) => key.kind === 'key').length;
        return (
          <Branch
            key={id}
            name={`${item.label || id} ${count} keys${item.mirror ? ' · linked' : ''}`}
            active={active}
            selected={selected}
            choose={() => choose({ section: 'clusters', id })}
          >
            {item.arrangement?.type === 'columns' ? (
              <>
                {item.arrangement.columns?.map((column, index) => {
                  const keys = members.filter(
                    ([, key]) => key.cell?.[0] === column
                  );
                  const selectedColumn =
                    selection.section === 'columns' &&
                    selection.cluster === id &&
                    selection.id === column;
                  return (
                    <Branch
                      key={column}
                      name={`Column ${index + 1} · ${column}`}
                      active={
                        selectedColumn ||
                        keys.some(
                          ([key]) =>
                            selection.section === 'objects' &&
                            selection.id === key
                        )
                      }
                      selected={selectedColumn}
                      choose={() =>
                        choose({ section: 'columns', cluster: id, id: column })
                      }
                    >
                      {keys.map(keyNode)}
                    </Branch>
                  );
                })}
                {members.filter(([, key]) => !key.cell).map(keyNode)}
              </>
            ) : (
              members.map(keyNode)
            )}
          </Branch>
        );
      })}
    </div>
  );
}
