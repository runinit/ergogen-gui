import type { PwaState } from '../App';
import { useEffect, useRef, useState, type SetStateAction } from 'react';
import styled from 'styled-components';
import { useConfigContext } from '../context/ConfigContext';
import type { Injection } from '../atoms/InjectionRow';
import { theme } from '../theme/theme';
import Injections from './Injections';
import InjectionEditor from './InjectionEditor';
import SettingsOptions from './SettingsOptions';

const Panel = styled.dialog`
  color: ${theme.colors.text};
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.cad.fieldRadius};
  padding: ${theme.spacing.lg};
  width: min(
    ${theme.studio.settingsWidth},
    calc(100vw - ${theme.spacing.lg} * 2)
  );
  max-height: calc(100dvh - ${theme.spacing.lg} * 2);
  overflow: auto;
  box-sizing: border-box;
  &::backdrop {
    background: ${theme.colors.backdrop};
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing.md};
  }
  .injection-code {
    height: ${theme.caseWizard.solidHeight};
    margin-top: ${theme.spacing.md};
  }
`;
const EMPTY: Injection = { key: -1, type: '', name: '', content: '' };

export default function StudioSettings({
  onClose,
  pwaState,
  onLibrary,
}: {
  pwaState?: PwaState;
  onClose: () => void;
  onLibrary: () => void;
}) {
  const context = useConfigContext();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(EMPTY);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    if (element?.showModal) {
      element.showModal();
    } else {
      element?.setAttribute('open', '');
    }
    element?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  if (!context) {
    return null;
  }

  const edit = (value: SetStateAction<Injection>) => {
    const next = typeof value === 'function' ? value(selected) : value;
    setSelected(next);
    if (next.key < 0 || !next.name || !next.content) {
      return;
    }
    const existing = context.injectionInput?.[next.key];
    if (
      existing?.[0] === next.type &&
      existing[1] === next.name &&
      existing[2] === next.content
    ) {
      return;
    }
    context.setInjectionInput((current) => {
      const entries = [...(current || [])];
      entries[next.key] = [next.type, next.name, next.content];
      return entries;
    });
  };
  const remove = (entry: Injection) => {
    context.setInjectionInput((current) =>
      current?.filter((_, index) => index !== entry.key)
    );
    setSelected((current) => {
      if (current.key === entry.key) {
        return EMPTY;
      }
      return current.key > entry.key
        ? { ...current, key: current.key - 1 }
        : current;
    });
  };
  return (
    <Panel
      ref={dialog}
      aria-label="Project settings"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header>
        <h2>Settings</h2>
        <button onClick={onClose}>Close settings</button>
      </header>
      <p>Layout updates automatically. Generate builds 3D outputs.</p>
      <SettingsOptions mode="native" pwaState={pwaState} />
      <details>
        <summary>Advanced libraries</summary>
        <Injections
          injectionToEdit={selected}
          setInjectionToEdit={edit}
          deleteInjection={remove}
          onOpenLibrary={onLibrary}
        />
        {selected.key >= 0 && (
          <>
            <label>
              Library name
              <input
                value={selected.name}
                onChange={(event) =>
                  edit({ ...selected, name: event.target.value })
                }
              />
            </label>
            <InjectionEditor
              className="injection-code"
              injection={selected}
              setInjection={edit}
            />
          </>
        )}
      </details>
    </Panel>
  );
}
