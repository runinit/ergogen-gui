#!/bin/sh
set -eu
ROOT=$(pwd)
PATCH_DIR="$ROOT/patch/kicanvas"
REVISION=$(cat "$PATCH_DIR/revision")
BUILD=$(mktemp -d)
trap 'rm -rf "$BUILD"' EXIT
trap 'exit 1' INT TERM

git clone https://github.com/theacodes/kicanvas.git "$BUILD/source"
git -C "$BUILD/source" checkout --detach "$REVISION"
git -C "$BUILD/source" apply "$PATCH_DIR/kicad10.patch"
cp "$PATCH_DIR/pnpm-lock.yaml" "$BUILD/source/pnpm-lock.yaml"
cp "$PATCH_DIR/test-net-registry.fixture" "$BUILD/source/test-net-registry.ts"
(
  cd "$BUILD/source"
  pnpm install --ignore-workspace --frozen-lockfile --ignore-scripts
  pnpm exec esbuild test-net-registry.ts --bundle --platform=node --format=cjs --loader:.glsl=text --loader:.kicad_wks=text --outfile=net-test.cjs
  node net-test.cjs
  pnpm run build
)
# Replace the deployed bundle only after the pinned source passes and builds.
cp "$BUILD/source/build/kicanvas.js" "$ROOT/public/dependencies/kicanvas.js"
