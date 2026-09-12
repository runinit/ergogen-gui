import styled, { keyframes } from 'styled-components';
import { theme } from '../theme/theme';

const paneEntry = keyframes`
  from { transform: translateX(8px); }
  to { transform: translateX(0); }
`;

export const StudioShell = styled.section`
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: ${theme.colors.text};
  background: ${theme.colors.background};
  font-family: ${theme.fonts.body};
  font-size: ${theme.workbench.textSize};
  line-height: 1.45;
  overflow: hidden;
  color-scheme: dark;
  scrollbar-color: ${theme.colors.border} ${theme.colors.background};
  scrollbar-width: thin;
  ::selection {
    background: ${theme.studio.selected};
    color: ${theme.colors.text};
  }
  input,
  textarea {
    caret-color: ${theme.colors.accent};
  }
  input[type='number'] {
    font-variant-numeric: tabular-nums;
  }
  a {
    text-underline-offset: 3px;
  }
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
    min-height: ${theme.workbench.controlHeight};
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing.sm};
    cursor: pointer;
    transition:
      background-color ${theme.workbench.stateMotion},
      border-color ${theme.workbench.stateMotion};
  }
  button:hover:not(:disabled) {
    background: ${theme.colors.buttonHover};
    border-color: ${theme.workbench.borderHover};
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
    background: ${theme.workbench.primary};
    border-color: ${theme.workbench.primary};
    color: ${theme.colors.white};
  }
  button[data-primary='true']:hover:not(:disabled) {
    background: ${theme.workbench.primaryHover};
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid ${theme.colors.accent};
    outline-offset: 2px;
  }
  [data-object]:focus {
    outline: none;
  }
  [data-object]:focus-visible polygon {
    stroke: ${theme.colors.accent};
    stroke-width: 2px;
    stroke-dasharray: 4px 2px;
    vector-effect: non-scaling-stroke;
  }
  input,
  select,
  textarea {
    min-width: 0;
    max-width: 100%;
    padding: ${theme.spacing.sm};
    min-height: ${theme.workbench.controlHeight};
  }
  input[type='checkbox'] {
    min-height: auto;
    width: 18px;
    height: 18px;
  }
  summary {
    cursor: pointer;
    padding: ${theme.spacing.sm} 0;
    font-weight: 500;
  }
  @media (min-width: ${theme.studio.breakpoint}) {
    .studio-mobile-tools,
    .mobile-only {
      display: none;
    }
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    button,
    input,
    select {
      min-height: ${theme.studio.touchSize};
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
  .studio-code {
    flex: 1;
    min-height: 0;
    height: 100%;
  }
  h2 {
    font-size: ${theme.workbench.titleSize};
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
    font-size: ${theme.workbench.titleSize};
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
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: transparent;
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
  }
  .workspace-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: ${theme.spacing.xs};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    button {
      border-radius: ${theme.cad.fieldRadius};
      padding: ${theme.spacing.sm};
    }
  }
  button[aria-current='step'] {
    border-bottom-color: ${theme.colors.accent};
    color: ${theme.colors.accent};
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    flex-wrap: wrap;
    .workspace-actions {
      width: 100%;
      border-top: 1px solid ${theme.colors.border};
      justify-content: flex-end;
      button {
        flex-direction: row;
        flex: initial;
        font-size: ${theme.workbench.textSize};
      }
    }
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
      min-width: 0;
      flex-wrap: wrap;
      button {
        padding: ${theme.spacing.sm};
      }
    }
    .project-actions button[data-primary] {
      margin-left: auto;
    }
  }
`;
export const StudioBody = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  position: relative;
  overflow: hidden;
  &[data-sheet='inspector'] {
    grid-template-columns: ${theme.studio.treeWidth} minmax(0, 1fr) ${theme
        .studio.inspectorWidth};
    > main {
      grid-column: 2;
    }
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    &[data-sheet='inspector'] {
      grid-template-columns: minmax(0, 1fr);
      > main {
        grid-column: 1;
      }
    }
  }
`;
export const StudioPane = styled.aside<{ $open: boolean }>`
  display: ${(p) => (p.$open ? 'contents' : 'none')};
  .pane-header {
    display: none;
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    display: ${(p) => (p.$open ? 'block' : 'none')};
    position: absolute;
    inset: 0 0 0 auto;
    width: min(90%, ${theme.studio.inspectorWidth});
    overflow: auto;
    background: ${theme.colors.backgroundLight};
    border-left: 1px solid ${theme.colors.border};
    z-index: ${theme.studio.popoverLayer};
    animation: ${paneEntry} ${theme.workbench.paneMotion};
    .pane-header {
      display: block;
      position: sticky;
      top: 0;
      z-index: 1;
      background: ${theme.colors.backgroundLight};
    }
    .selection-summary {
      margin: 0;
      padding: 0 ${theme.spacing.sm} ${theme.spacing.sm};
      color: ${theme.colors.textDarker};
      overflow-wrap: anywhere;
      font-size: ${theme.fontSizes.bodySmall};
    }
    &[data-setup] .pane-tabs,
    &[data-setup] .selection-summary {
      display: none;
    }
    .pane-tabs {
      display: flex;
      gap: ${theme.spacing.xs};
      padding: ${theme.spacing.sm};
      border-bottom: 1px solid ${theme.colors.border};
    }
    .pane-tabs button {
      flex: 1;
      font-size: ${theme.fontSizes.bodySmall};
      padding: ${theme.spacing.sm};
    }
    &[data-pane='properties'] .studio-browser,
    &[data-pane='objects'] .studio-properties {
      display: none;
    }
    .close-pane {
      display: flex;
      margin: ${theme.spacing.sm};
    }
  }
  @media (max-width: ${theme.workbench.phoneBreakpoint}) {
    width: 100%;
    border-left: 0;
  }
`;
export const StudioBrowser = styled.div`
  grid-column: 1;
  grid-row: 1;
  min-height: 0;
  overflow: auto;
  padding: ${theme.spacing.md};
  background: ${theme.colors.backgroundLight};
  border-right: 1px solid ${theme.colors.border};
  > details + details {
    margin-top: ${theme.spacing.md};
    border-top: 1px solid ${theme.colors.border};
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    border-right: 0;
  }
`;
export const StudioProperties = styled.div`
  grid-column: 3;
  grid-row: 1;
  min-height: 0;
  overflow: auto;
  padding: ${theme.spacing.md};
  background: ${theme.colors.backgroundLight};
  border-left: 1px solid ${theme.colors.border};
  h2 {
    overflow-wrap: anywhere;
  }
  fieldset {
    min-width: 0;
  }
  input,
  select,
  textarea {
    background: ${theme.workbench.fieldSurface};
  }
  @media (max-width: ${theme.studio.breakpoint}) {
    border-left: 0;
    border-top: 1px solid ${theme.colors.border};
  }
`;
export const StudioMain = styled.main`
  grid-column: 1;
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

// Keep editor drafts mounted while another project view is active.
export const StudioLibrary = styled.div<{ $active: boolean }>`
  display: ${({ $active }) => ($active ? 'contents' : 'none')};
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
    color: ${theme.colors.accent};
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
  font-size: ${theme.fontSizes.bodySmall};
  button {
    margin-left: auto;
  }
`;
