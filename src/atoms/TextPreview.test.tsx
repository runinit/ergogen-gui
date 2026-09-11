import type { ComponentProps } from 'react';
import type { EditorProps } from '@monaco-editor/react';
import { expectTypeOf, it } from 'vitest';
import TextPreview from './TextPreview';

it('accepts Monaco editor options', () => {
  expectTypeOf<ComponentProps<typeof TextPreview>['options']>().toEqualTypeOf<
    EditorProps['options']
  >();
});
