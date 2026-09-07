const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Dereference package links into a disposable copy before applying GUI patches.
const stageErgogen = (installed, parent = os.tmpdir()) => {
  const source = fs.realpathSync(installed);
  const stage = fs.mkdtempSync(path.join(parent, 'ergogen-gui-build-'));
  try {
    fs.cpSync(source, stage, {
      recursive: true,
      dereference: true,
      filter: (entry) =>
        !['node_modules', '.git', 'dist'].includes(path.basename(entry)),
    });
    return stage;
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
};

module.exports = { stageErgogen };

if (require.main === module) {
  console.log(stageErgogen(process.argv[2]));
}
