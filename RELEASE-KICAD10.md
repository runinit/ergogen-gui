# KiCad 10 release validation

Status: deployed and verified. The generator is built locally; no npm package was published.

## Local generator

- GUI: 0.19.0, `ergogen: file:vendor/runinit-ergogen-5.0.0.tgz`.
- Node 24.20.0; pnpm 11.3.0.
- The tested generator source tarball is checked in under `vendor/`.
- Standard builds use the committed lockfile without `ERGOGEN_VERSION`.
- KiCanvas source: `b031159eb74aaa7eef2b026fd85d35bc05ff2095`.
- ceoloide footprints: `54a23cc9d025ef3a3d1c42b0452d1ceac681ea5a`.
- infused-kim footprints: `bb80a207d8a6fa7b9245caad2c2d97e2adc2f612`.

## Implemented

KiCanvas has a common board net registry for every copper item, including
numeric-looking, empty, local, and escaped names. Malformed input is rejected.
The source patch, immutable revision, dependency lock, test, build recipe, and
MIT attribution live in `patch/kicanvas/`. Only successful builds replace the
viewer bundle.

Viewer load/error events drive an accessible preview error. Regeneration clears
obsolete errors. Downloads retain the original PCB bytes. Legacy KiCad previews
explain that download remains available.

Vite, HTML assets, router, workers, and service-worker URLs use `/ergogen-gui/`.
Run the production build before `pnpm run test:e2e`; Playwright serves `dist`
without reusing another server. Pages deploys the checked artifact and accepts
neither a generator override nor custom-domain configuration.

## Validation and remaining gates

Generator: 120 full tests pass; coverage and bundle build succeed under Node 24.
The separate focused, historical-snapshot, extracted-package, and KiCad/BHK
checks are documented in the generator repository.

Candidate precommit passes: 386 unit tests, no lint errors, six existing unused
symbol warnings. All six Node release checks and the production build pass.
Production Playwright passes 21 checks plus three offline/cache checks; one
existing GitHub API test remains skipped. The final tarball is also installed
and tested through the disposable candidate override.

The isolated workspace browser displays recognizable BHK geometry and selects
GND in the net inspector. Its actual 675,245-byte PCB download matches generator
output exactly and loads/saves in KiCad 10.0.6. Playwright verifies offline BHK
regeneration, preview, and identical downloads under `/ergogen-gui/`, and ignores
a seeded obsolete dependency cache. Manual CDP offline navigation fails with
`ERR_FAILED`; that separate browser check remains unverified.

Regression tests failed before fixing empty-net rendering/selection and late
service-worker registration. Viewer tests cover malformed input recovery and
WebGL initialization errors. Mobile outputs hide while editing; worker builds
include the pinned footprint sources without modifying dependency stores.

The generator is built from the checked-in local source archive. No npm login
or publication is required. Pages is configured for workflow deployment with
no custom domain. Clean standalone validation passes with the local archive and frozen lockfile.
Deployment of `6871b5e31cf39fed0a1a9e72f604db47e06f04ab` passed every CI gate:
<https://github.com/runinit/ergogen-gui/actions/runs/34170128233>

Live site: <https://runinit.github.io/ergogen-gui/>

All six live browser checks pass, including malformed-input recovery, WebGL
errors, BHK rendering, stale-cache isolation, and offline BHK regeneration with
identical downloads. Seven delivered assets match the tested Pages artifact
byte for byte. The GUI reports 0.19.0 and generator 5.0.0. Layer visibility,
GND selection, and keyboard navigation pass with no runtime errors. The actual
675,245-byte live download matches generator output and loads, saves, and
reloads in KiCad 10.0.6. Local standalone tests: 386 unit, six release, and
24 production Playwright checks pass; one existing test remains skipped.

BHK KiCad 8/10 geometry, 3,556 connectivity records, and all 993 normalized
DRC violations match; 206 unconnected items remain. All 21 Gerbers match after
removing timestamps. See the generator's normalization details.

## Artifact hashes (SHA-256)

- Tested generator tarball: `c1c65aeda48d01d346a9c24743184eac23dcb726e0cb8764a9dccc04f9968994`
- Rebuilt KiCanvas: `ac368c697f274c8856241a1832ea11bc60043c414c68086b1f7a421449c0becf`
- Actual BHK GUI download: `82a1cbebfee642013336f2c0c69504957c85046549ed5cb1803579d9e0768c62`

Generator source: `6140bd1` on `runinit/ergogen` branch `release/kicad10`.
The tarball passes independent exact-lock installation, all 120 tests,
nine focused checks, 15 historical snapshots, and CLI version inspection.
