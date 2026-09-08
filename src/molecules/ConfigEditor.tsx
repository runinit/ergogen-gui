import { Editor, OnMount } from '@monaco-editor/react';
import React, { useCallback, useEffect, useRef } from 'react';
import debounce from 'lodash.debounce';
import { DESIGN_EDIT_EVENT, DesignEditEvent } from '../utils/designSource';
import { useConfigContext } from '../context/ConfigContext';

/**
 * Defines the options for the Monaco Editor instance.
 * @typedef {object} EditorOptions
 * @property {boolean} [readOnly] - If true, the editor will be in read-only mode.
 */
type EditorOptions = {
  readOnly?: boolean;
};

/**
 * Props for the ConfigEditor component.
 * @typedef {object} Props
 * @property {string} [className] - An optional CSS class name for the component's container.
 * @property {EditorOptions} [options] - Optional settings for the Monaco Editor.
 * @property {string} [data-testid] - An optional data-testid attribute for testing purposes.
 */
type Props = {
  className?: string;
  options?: EditorOptions;
  'data-testid'?: string;
  'aria-label'?: string;
};

/**
 * A component that provides a YAML editor for configuring Ergogen settings.
 * It uses the Monaco Editor for a rich editing experience and integrates with the ConfigContext
 * to manage the configuration state.
 *
 * @param {Props} props - The props for the component.
 * @returns {JSX.Element} A container with the Monaco Editor instance.
 */
const ConfigEditor = ({
  className,
  options,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}: Props) => {
  const configContext = useConfigContext();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Provide safe defaults when context is null to avoid conditional hooks
  const defaults = {
    configInput: undefined as string | undefined,
    setConfigInput: ((
      _val: string | undefined
    ) => {}) as unknown as React.Dispatch<
      React.SetStateAction<string | undefined>
    >,
    updateRealtimeConfigInput: (_val: string | undefined) => {},
    injectionInput: undefined as string[][] | undefined,
    generateNow: (async () => {}) as (
      textInput: string | undefined,
      injectionInput: string[][] | undefined,
      options?: { pointsonly: boolean }
    ) => Promise<void>,
    activeConfigId: null as string | null,
  };

  const {
    configInput,
    updateRealtimeConfigInput,
    setConfigInput,
    injectionInput,
    generateNow,
    activeConfigId,
  } = configContext ?? defaults;

  // Create a debounced setConfigInput to avoid updating context on every keystroke
  const debouncedSetConfigInput = useRef(
    debounce((val: string) => {
      setConfigInput(val);
    }, 500)
  ).current;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetConfigInput.cancel();
    };
  }, [debouncedSetConfigInput]);

  // Sync editor value with context configInput (only when changed from outside)
  useEffect(() => {
    if (editorRef.current) {
      // If the editor currently has focus, the changes came from user typing.
      // Do not overwrite the editor as that resets the cursor position.
      if (editorRef.current.hasTextFocus()) {
        return;
      }
      const currentVal = editorRef.current.getValue();
      if (configInput !== undefined && configInput !== currentVal) {
        editorRef.current.setValue(configInput);
      }
    }
  }, [configInput]);

  /**
   * Handles changes in the editor's content.
   * Updates the global configuration state if the input is valid.
   * @param {string | undefined} textInput - The new text content from the editor.
   */
  const handleChange = useCallback(
    (textInput: string | undefined) => {
      if (textInput === undefined) return;

      // Sync the realtime value ref immediately (without triggering re-renders)
      updateRealtimeConfigInput(textInput);

      // Debounce the state/localStorage update
      debouncedSetConfigInput(textInput);
    },
    [debouncedSetConfigInput, updateRealtimeConfigInput]
  );

  useEffect(() => {
    const apply = (event: Event) => {
      const detail = (event as CustomEvent<DesignEditEvent>).detail;
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model || editor.getValue() !== detail.before) {
        return;
      }
      let start = 0;
      while (
        detail.before[start] === detail.after[start] &&
        start < detail.before.length &&
        start < detail.after.length
      ) {
        start++;
      }
      let end = detail.before.length,
        nextEnd = detail.after.length;
      while (
        end > start &&
        nextEnd > start &&
        detail.before[end - 1] === detail.after[nextEnd - 1]
      ) {
        end--;
        nextEnd--;
      }
      const from = model.getPositionAt(start),
        to = model.getPositionAt(end);
      debouncedSetConfigInput.cancel();
      editor.pushUndoStop();
      editor.executeEdits('design', [
        {
          range: {
            startLineNumber: from.lineNumber,
            startColumn: from.column,
            endLineNumber: to.lineNumber,
            endColumn: to.column,
          },
          text: detail.after.slice(start, nextEnd),
        },
      ]);
      editor.pushUndoStop();
      updateRealtimeConfigInput(detail.after);
      setConfigInput(detail.after);
      detail.applied = true;
    };
    window.addEventListener(DESIGN_EDIT_EVENT, apply);
    return () => window.removeEventListener(DESIGN_EDIT_EVENT, apply);
  }, [debouncedSetConfigInput, setConfigInput, updateRealtimeConfigInput]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Flush/save changes immediately on blur to ensure download/generate buttons have the latest value
    editor.onDidBlurEditorText(() => {
      debouncedSetConfigInput.flush();
    });

    editor.addAction({
      id: 'generate-config',
      label: 'Generate',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        const currentConfig = editor.getValue();
        // Cancel pending debounces and apply immediately
        debouncedSetConfigInput.cancel();
        updateRealtimeConfigInput(currentConfig);
        setConfigInput(currentConfig);
        generateNow(currentConfig, injectionInput, { pointsonly: false });
      },
    });
  };

  if (!configContext) return null;

  return (
    <div className={className} data-testid={dataTestId} aria-label={ariaLabel}>
      <Editor
        key={activeConfigId || 'preview'}
        height="100%"
        defaultLanguage="yaml"
        language="yaml"
        onChange={handleChange}
        onMount={handleEditorDidMount}
        defaultValue={configInput}
        theme={'ergogen-theme'}
        options={options || undefined}
      />
    </div>
  );
};

export default ConfigEditor;
