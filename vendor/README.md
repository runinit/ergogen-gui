# Local Ergogen source

`ergogen-dcc4db6.tgz` contains generator source from
[`runinit/ergogen@dcc4db6`](https://github.com/runinit/ergogen/commit/dcc4db6eefcf04fc161db545a89421628d24d283).
It retains the upstream MIT license and attribution.

SHA-256: `c922cfb00776094f3802671e3af401f231f21aa5c160ff74f5a70b38cc8f26da`

The archive supplies the full enclosure and parametric design pipeline. pnpm
installs it locally; the patch recipe builds it in a temporary directory.
No npm publication or version override is required.

To update: validate and commit the engine, pack that exact checkout, replace
the archive, record its commit and hash, then refresh the lockfile and build.
The older 5.0.0 archive records the production baseline.
