# Local Ergogen source

`runinit-ergogen-5.0.0.tgz` contains generator source from
[`runinit/ergogen@6140bd12828e035b5fd375e83be0edc073a02301`](https://github.com/runinit/ergogen/commit/6140bd12828e035b5fd375e83be0edc073a02301).
It retains the upstream MIT license and attribution inside the archive.

SHA-256: `c1c65aeda48d01d346a9c24743184eac23dcb726e0cb8764a9dccc04f9968994`

pnpm installs this local archive through `file:vendor/runinit-ergogen-5.0.0.tgz`.
The GUI builds the generator in a temporary directory using its existing patch
recipe. No generator npm publication or version override is required.

To update it, pack a validated generator checkout into this directory, update
the source revision and hash here, refresh the pnpm lockfile, then run the
release checks and production build. Commit the archive and generated assets
together. Do not edit the archive by hand.
