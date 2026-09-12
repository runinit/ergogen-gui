declare module 'ergogen';
declare module 'ergogen/src/utils';
declare module 'ergogen/src/assert';
declare module 'ergogen/src/operation';
declare module 'ergogen/src/point';
declare module 'ergogen/src/prepare';
declare module 'ergogen/src/anchor';
declare module 'ergogen/src/filter';

declare module 'ergogen/src/footprint-tools';

declare module 'ergogen/src/native/layout' {
  export function resolve(
    config: unknown
  ): import('ergogen/src/native').LayoutReport;
}
