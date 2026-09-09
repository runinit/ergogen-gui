# Local Ergogen source

`ergogen-415fd3a.tgz` contains generator source from
[`runinit/ergogen@415fd3a`](https://github.com/runinit/ergogen/commit/415fd3ae1895a7ccc5ed5a3a28e90b2dd6846b41).
It retains the upstream MIT license and attribution.

SHA-256: `fdc593ebf31d0c51ae92d260fc51ace88498e9d4ae12aa9826f70bd8de79e30b`

The archive supplies the full enclosure and parametric design pipeline. pnpm
installs it locally; the patch recipe builds it in a temporary directory.
No npm publication or version override is required.

To update: validate and commit the engine, pack that exact checkout, replace
the archive, record its commit and hash, then refresh the lockfile and build.
The older 5.0.0 archive records the production baseline.

## Guided mounting follow-up

`ergogen-guided-d8de34fdf6bb.tgz` is the local enclosure-work source snapshot
for optional component envelopes, requested contact counts and cached analysis.
It retains the upstream license and attribution.

SHA-256: `d8de34fdf6bb70a1d1c7c45bcf2af4c8f23bb919dc69313d16f2756e10ade6e1`

## CAD workspace snapshot

`ergogen-cad-e2d947209f40.tgz` contains the current dirty `enclosure-work/ergogen`
source, including the guided mounting work and reusable footprint/model helpers.
This is a local source snapshot, not a published release.

SHA-256: `e2d947209f4023d15ebeeb1582b6dedce72762b227f202b4f319b29a95b9fdd7`

The GUI dependency and lockfile select this archive. The normal build repackages
the engine into `public/dependencies/ergogen.js` before Vite builds the GUI.
