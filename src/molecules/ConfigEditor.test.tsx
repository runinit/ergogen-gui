import { render } from '@testing-library/react';
import ConfigEditor from './ConfigEditor';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  action: undefined as undefined | (() => void),
}));
vi.mock('../context/ConfigContext', () => ({
  useConfigContext: () => ({
    configInput: 'schema: ergogen/v1',
    generateNow: mocks.generate,
  }),
}));
vi.mock('@monaco-editor/react', () => ({
  Editor: ({
    onMount,
  }: {
    onMount: (editor: unknown, monaco: unknown) => void;
  }) => {
    onMount(
      {
        getModel: () => null,
        getValue: () => 'schema: ergogen/v1',
        addAction: ({ id, run }: { id: string; run: () => void }) => {
          if (id === 'generate-config') {
            mocks.action = run;
          }
        },
      },
      {
        KeyMod: { CtrlCmd: 1, Shift: 2 },
        KeyCode: { KeyZ: 1, KeyY: 2, Enter: 3 },
      }
    );
    return null;
  },
}));

it('routes the editor shortcut to the workspace generation controller', () => {
  const generate = vi.fn();
  render(<ConfigEditor onGenerate={generate} />);
  mocks.action?.();
  expect(generate).toHaveBeenCalledOnce();
  expect(mocks.generate).not.toHaveBeenCalled();
});
