import { useState } from 'react';
import styled from 'styled-components';
import LayoutView from './LayoutView';
import DesignView from './DesignView';
import { theme } from '../theme/theme';

const Workspace = styled.section`
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  nav {
    display: flex;
    gap: ${theme.spacing.sm};
    padding: ${theme.spacing.sm};
  }
  button {
    color: ${theme.colors.text};
    background: ${theme.colors.backgroundLight};
    border: 1px solid ${theme.colors.border};
    padding: ${theme.spacing.sm};
  }
  button[aria-pressed='true'] {
    border-color: ${theme.colors.accent};
  }
`;
export default function DesignWorkspace() {
  const [view, setView] = useState('layout');
  return (
    <Workspace aria-label="Design workspace">
      <nav aria-label="Design tools">
        <button
          aria-pressed={view === 'layout'}
          onClick={() => setView('layout')}
        >
          Layout
        </button>
        <button
          aria-pressed={view === 'sketch'}
          onClick={() => setView('sketch')}
        >
          Sketches
        </button>
      </nav>
      {view === 'layout' ? <LayoutView /> : <DesignView />}
    </Workspace>
  );
}
