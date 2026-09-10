// Rebuild lightweight previews from the pinned, unmodified source models.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../public/components');
(async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, 'manifest.json'), 'utf8')
  );
  const r = await import('replicad');
  const { default: init } = await import('replicad-opencascadejs');
  r.setOC(await init());
  for (const model of manifest.models) {
    const bytes = await fs.readFile(path.join(root, model.file));
    if (
      crypto.createHash('sha256').update(bytes).digest('hex') !== model.sha256
    ) {
      throw new Error(`Source hash mismatch: ${model.file}`);
    }
    const shape = await r.importSTEP(new Blob([bytes]));
    try {
      const box = shape.boundingBox;
      try {
        model.bounds = box.bounds;
      } finally {
        box.delete();
      }
      model.preview = `${model.file}.stl`;
      const mesh = new Uint8Array(
        await shape
          .blobSTL({ binary: true, tolerance: 0.25, angularTolerance: 0.5 })
          .arrayBuffer()
      );
      await fs.writeFile(path.join(root, model.preview), mesh);
      console.log(model.file, model.bounds, mesh.length);
    } finally {
      shape.delete();
    }
  }
  await fs.writeFile(
    path.join(root, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
