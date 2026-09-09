# CAD workspace validation

Local `enclosure-work` implementation, September 8–9, 2026. The two existing
`feature/enclosure-wizard` checkouts retain their unfinished work. No publication
or fabrication approval is implied.

## Reproduce

Engine (`../ergogen`):

```sh
npm test
npm run build
npm pack --pack-destination /tmp/ergogen-cad-validation
```

GUI:

```sh
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run
pnpm run build
PLAYWRIGHT_PORT=3002 NODE_OPTIONS=--no-experimental-webstorage \
  pnpm exec playwright test --reporter=line --workers=2
pnpm exec knip
```

Node 26's experimental native localStorage conflicts with jsdom; the test flag
uses the repository's browser-storage harness. Port 3002 isolates test previews
from the user's existing server. Port 3001 serves the local production build.

## Covered behavior

- SMD, through-hole, duplicate-numbered and mechanical pads; back-side placement,
  rotations, quoted strings, drills, layers, properties, UUIDs and unknown metadata.
- Ordinary CommonJS exports and dynamic footprint bodies. Model-only changes
  preserve pads, nets, tracks, comments and unrelated footprint source.
- Multiple models, both board sides, negative KiCad rotations, legacy offset
  units, collision-safe asset identities, STL-to-VRML and original STEP bytes.
- Library drafts, explicit identities, conflicting revisions, two-project
  propagation, per-instance overrides, undo, aliases and inherited YAML values.
- Cancellation and obsolete worker responses across source, injection, library
  and asset revisions. Failed generation retains the last valid preview.
- Standard KiCad references, GitHub/GitLab links, 404/429/CORS/HTML failures,
  retries, local upload and successful cached imports.
- Batch imports, portable footprint/project ZIPs, source-only and bulk exports,
  old project imports and opening an exported snapshot in a fresh offline browser.
- Declaration-based assembly tree, grouped placements, visibility, contextual
  selection, generated hardware links, keyboard navigation and narrow drawers.

## Browser fixtures

`e2e/footprint-library.spec.ts` imports the official KiCad 0603 capacitor and STEP
bundle, maps its two nets, aligns it, links four placements, generates a case and
exports it. A duplicated project retains its explicit model override when library
revision 2 updates both projects. A fresh browser imports the revision 1 snapshot
and generates offline.

The BHK fixture assigns one original STEP model to 33 capacitor placements and
exports the full case and PCB. The canvas shows **139 populated components**;
KiCad contains **145 footprints**, including mounting holes. The fixture explicitly
places the reversible switch bodies opposite their footprint face, uses FDM and
sets internal radius to zero. These are mechanical test assumptions. Missing
component and keycap envelopes remain incomplete checks; this is not proof that
the default CNC configuration or physical BHK assembly is ready to manufacture.

## KiCad 10.0.6 inspection

The actual GUI ZIPs were extracted into disposable directories and loaded through
KiCad 10.0.6's `pcbnew.LoadBoard`.

| Artifact              | Inspection                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Four-component import | 4 footprints; pads 1/2 retain GND/SIGNAL; Z offset 1 mm; all portable model references resolve   |
| BHK export            | 145 footprints; 1,122 pads; 2,433 tracks; 126 nets; 33 cached capacitor model references resolve |
| Mixed-pad conversion  | Front/back 90° placements retain pad orientation, drills, mechanical pads and mapped nets        |
| STL project           | Portable controller.wrl resolves beside the board; original controller.stl remains in assets     |

Every exported capacitor STEP hashes to
`4857b3dc717675bf1fb22edda622ac3b3ae03cf44d81eefaf3fa3ba3a86d84c1`, matching the
unmodified official source. KiCad's Python binding emits three startup enum
assertion warnings; board loading and model/path inspection complete.

## Evidence and limits

Engine: **225 passing**. After the TypeScript cleanup, GUI unit tests:
**491 passing across 67 files**.
The production build passes. The final full browser suite reports **44 passing,
1 existing skipped test**, including BHK, library propagation, offline import,
explicit generation, STL export and the long-name layout regression.

The GUI installs `vendor/ergogen-cad-e2d947209f40.tgz` (SHA-256
`e2d947209f4023d15ebeeb1582b6dedce72762b227f202b4f319b29a95b9fdd7`).
Installed engine source matches the working engine source byte for byte.
The served engine bundle matches `public/dependencies/ergogen.js`, SHA-256
`551b4ba7005393a657ec728a122e39ce28b0906d7fe515a26f482e4441df8c95`.

Run logs, extracted artifacts and byte checks are under
`/tmp/ergogen-cad-validation`. Browser tests regenerate their ZIPs and screenshots
in `test-results`. Durable screenshots are in `public/images/changelog`.

The standalone TypeScript check now passes, including unit tests. Tests use
Vitest directly; the Jest runtime alias has been removed. `pnpm run typecheck`
is included in precommit and both CI workflows through that command.
The cleanup's six browser checks pass: PCB rendering, case generation and
selection, boundary repair, manufacturing presets and offline reopening.
Its regression tests reproduce and fix pre-generation part selection crashes
and missing/trailing-slash service-worker base URLs. Cleanup logs are saved as
`/tmp/cad-types-*.log`.
Existing unused test-variable lint warnings and Knip configuration hints remain.
No installed desktop KiCad GUI or fabrication/DRC approval is claimed.

Custom/trapezoid pads use simplified lightweight outlines, with a visible notice;
their exact imported source remains in exports. Unsupported transforms stop with
an actionable diagnostic. Offline reopening assumes the application itself has
already been cached, as exercised by the browser test.

See [visual comparison](design-qa.md) and [user guide](CAD-WORKSPACE.md).
