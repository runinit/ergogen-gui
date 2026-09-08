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
