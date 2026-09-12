import { Editor, OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useConfigContext } from '../context/ConfigContext';

type Props = {
  className?: string;
  options?: { readOnly?: boolean };
  onGenerate?: () => void;
  'data-testid'?: string;
  'aria-label'?: string;
};

export default function ConfigEditor({
  className,
  options,
  onGenerate,
  ...attributes
}: Props) {
  const context = useConfigContext();
  const live = useRef(context);
  live.current = context;
  const generate = useRef(onGenerate);
  generate.current = onGenerate;
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const syncing = useRef(false);
  const source = context?.configInput;

  // Apply only the changed range; project undo also works while Code has focus.
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || source === undefined) {
      return;
    }
    const before = editor.getValue();
    if (before === source) {
      return;
    }
    let start = 0,
      end = before.length,
      nextEnd = source.length;
    while (start < end && start < nextEnd && before[start] === source[start]) {
      start++;
    }
    while (
      end > start &&
      nextEnd > start &&
      before[end - 1] === source[nextEnd - 1]
    ) {
      end--;
      nextEnd--;
    }
    const from = model.getPositionAt(start),
      to = model.getPositionAt(end);
    syncing.current = true;
    editor.executeEdits('project', [
      {
        range: {
          startLineNumber: from.lineNumber,
          startColumn: from.column,
          endLineNumber: to.lineNumber,
          endColumn: to.column,
        },
        text: source.slice(start, nextEnd),
      },
    ]);
    syncing.current = false;
  }, [source]);

  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addAction({
      id: 'project-undo',
      label: 'Undo project edit',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ],
      run: () => live.current?.undo?.(),
    });
    editor.addAction({
      id: 'project-redo',
      label: 'Redo project edit',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
      ],
      run: () => live.current?.redo?.(),
    });
    editor.addAction({
      id: 'generate-config',
      label: 'Generate',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        if (generate.current) {
          generate.current();
          return;
        }
        void live.current?.generateNow(
          editor.getValue(),
          live.current.injectionInput,
          { pointsonly: false }
        );
      },
    });
  };
  if (!context) {
    return null;
  }
  return (
    <div className={className} {...attributes}>
      <Editor
        key={context.activeConfigId || 'preview'}
        height="100%"
        defaultLanguage="yaml"
        language="yaml"
        defaultValue={source}
        theme="ergogen-theme"
        options={options}
        onMount={mount}
        onChange={(next) => {
          if (syncing.current || next === undefined) {
            return;
          }
          if (context.editSource) {
            context.editSource(next, 'code');
          } else {
            context.setConfigInput(next);
          }
        }}
      />
    </div>
  );
}
