import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type ElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'kicanvas-embed': ElementProps & {
        controls?: 'none' | 'basic' | 'full';
        controlslist?: string;
        theme?: 'kicad' | 'light' | 'dark';
        src?: string;
      };
      'kicanvas-source': ElementProps & { type?: 'board' | 'schematic' };
    }
  }
}
