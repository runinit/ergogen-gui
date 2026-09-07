const fs = require('node:fs');
const path = require('node:path');

// Stage the pinned library sources for the worker's existing injection loader.
const stageFootprints = (build, output) => {
  const index = fs.readFileSync(
    path.join(build, 'src/footprints/index.js'),
    'utf8'
  );
  const entries = [
    ...index.matchAll(/['"]([^'"]+)['"]:\s*require\(['"]\.\/([^'"]+)['"]\)/g),
  ];
  const footprints = Object.fromEntries(
    entries.map(([, name, file]) => [
      name,
      fs.readFileSync(
        require.resolve(path.join(build, 'src/footprints', file)),
        'utf8'
      ),
    ])
  );
  if (!entries.length) {
    throw new Error('No pinned footprints were staged');
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(footprints));
};

module.exports = { stageFootprints };

if (require.main === module) {
  stageFootprints(process.argv[2], process.argv[3]);
}
