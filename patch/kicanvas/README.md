# KiCanvas source build

Upstream: <https://github.com/theacodes/kicanvas>, MIT license (see LICENSE.md).
`revision` pins the source; `pnpm-lock.yaml` pins build dependencies.
`kicad10.patch` adds a board net registry, strict parsing, and preview events.
It also removes the external font stylesheet; the GUI bundles Fontsource fonts.

Run `pnpm run build-kicanvas` from the GUI root using Node 24 and pnpm 11.
The recipe tests and builds a temporary checkout before replacing the bundle.
The original downloadable board string is never rewritten.
