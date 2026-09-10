import styled from 'styled-components';
import { theme } from '../theme/theme';

export const StudioShell = styled.section`
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: ${theme.colors.text};
  background: ${theme.colors.background};
  font-family: ${theme.fonts.body};
  button,
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
    background: ${theme.colors.backgroundLight};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.cad.fieldRadius};
    box-sizing: border-box;
  }
  button {
    min-height: ${theme.studio.touchSize};
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing.sm};
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button[aria-pressed='true'],
  button[aria-selected='true'] {
    color: ${theme.colors.text};
    border-color: ${theme.colors.accent};
    background: ${theme.studio.selected};
  }
  button[data-primary='true'] {
    background: ${theme.colors.accent};
    border-color: ${theme.colors.accent};
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid ${theme.colors.accent};
    outline-offset: 2px;
  }
  input,
  select,
  textarea {
    min-width: 0;
    max-width: 100%;
    padding: ${theme.spacing.sm};
    min-height: ${theme.studio.touchSize};
  }
  input[type='checkbox'] {
    min-height: auto;
    width: 18px;
    height: 18px;
  }
  color-scheme: dark;
  summary {
    cursor: pointer;
    padding: ${theme.spacing.md} 0;
  }
  @media (min-width: ${theme.studio.breakpoint}) {
    .studio-mobile-tools,
    .mobile-only {
      display: none;
    }
  }
  .studio-code {
    flex: 1;
    min-height: 0;
    height: 100%;
  }
  h2 {
    font-size: ${theme.fontSizes.lg};
    margin: 0 0 ${theme.spacing.md};
  }
  h3 {
    font-size: ${theme.fontSizes.base};
    margin: ${theme.spacing.lg} 0 ${theme.spacing.md};
  }
  p {
    line-height: 1.45;
    color: ${theme.colors.textDark};
  }
  small {
    color: ${theme.colors.textDarker};
    line-height: 1.4;
  }
`;
export const StudioBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.border};
  flex-shrink: 0;
  h1 {
    font-size: ${theme.fontSizes.h3};
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    padding: ${theme.spacing.sm};
    .desktop {
      display: none;
    }
  }
`;
export const StageNav = styled.nav`
  display: flex;
  flex-shrink: 0;
  overflow-x: auto;
  border-bottom: 1px solid ${theme.colors.border};
  button {
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 0;
    background: transparent;
    padding: ${theme.spacing.md} ${theme.spacing.lg};
  }
  button[aria-current='step'] {
    border-bottom-color: ${theme.colors.accent};
    color: ${theme.colors.accent};
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    button {
      flex: 1;
      flex-direction: column;
      font-size: ${theme.fontSizes.sm};
      padding: ${theme.spacing.sm};
      gap: ${theme.spacing.xs};
    }
  }
`;
export const StudioHeader = styled(StudioBar)`
  h1 {
    flex: 1;
    min-width: 0;
  }
  .project-actions {
    display: flex;
    gap: ${theme.spacing.sm};
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    flex-wrap: wrap;
    h1 {
      font-size: ${theme.fontSizes.lg};
    }
    .project-actions {
      order: 1;
      width: 100%;
    }
    .project-actions button[data-primary] {
      margin-left: auto;
    }
    .project-actions .desktop {
      display: inline;
    }
  }
`;
export const StudioBody = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: ${theme.studio.treeWidth} minmax(0, 1fr) ${theme.studio
      .inspectorWidth};
  position: relative;
  overflow: hidden;
  @media (max-width: ${theme.studio.breakpoint}) {
    grid-template-columns: minmax(0, 1fr);
    &[data-sheet] {
      grid-template-rows: minmax(220px, 1fr) minmax(0, 1fr);
    }
  }
`;
export const StudioPane = styled.aside<{
  $side: 'left' | 'right';
  $open: boolean;
}>`
  min-height: 0; overflow: auto; padding: ${theme.spacing.md}; border-${(p) => (p.$side === 'left' ? 'right' : 'left')}: 1px solid ${theme.colors.border}; background: ${theme.colors.backgroundLight};
  grid-column: ${(p) => (p.$side === 'left' ? 1 : 3)}; grid-row: 1;
  .close-pane { display: none; }
  @media(max-width: ${theme.studio.breakpoint}) { display: ${(p) => (p.$open ? 'block' : 'none')}; position: relative; grid-row: 2; border-top: 1px solid ${theme.colors.border}; z-index: ${theme.studio.panelLayer}; grid-column: 1; .close-pane { display: inline-flex; margin-bottom: ${theme.spacing.md}; } }
`;
export const StudioMain = styled.main`
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: auto;
  @media (max-width: ${theme.studio.breakpoint}) {
    grid-column: 1;
  }
`;
export const StudioField = styled.label`
  display: grid;
  grid-template-columns: minmax(70px, 0.85fr) minmax(0, 1fr);
  align-items: center;
  gap: ${theme.spacing.sm};
  margin: ${theme.spacing.sm} 0;
  small {
    grid-column: 2;
  }
`;
export const StudioActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.spacing.sm};
  margin: ${theme.spacing.sm} 0;
`;
export const TreeButton = styled.button`
  width: 100%;
  border-color: transparent !important;
  background: transparent !important;
  &[aria-pressed='true'],
  &[aria-selected='true'] {
    background: ${theme.studio.selected} !important;
    border-left: 3px solid ${theme.colors.accent} !important;
  }
  justify-content: flex-start !important;
  text-align: left;
  margin-bottom: ${theme.spacing.xs};
  span {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;
export const StudioStatus = styled.div`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-top: 1px solid ${theme.colors.border};
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${theme.spacing.sm};
  flex-shrink: 0;
  button {
    margin-left: auto;
  }
`;
