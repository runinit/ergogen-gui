const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stageErgogen } = require('../../patch/stage_ergogen');

test('stages a linked generator without changing its source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ergogen-stage-test-'));
  try {
    const source = path.join(root, 'source');
    const installed = path.join(root, 'installed');
    fs.mkdirSync(path.join(source, 'src'), { recursive: true });
    fs.writeFileSync(path.join(source, 'src', 'ergogen.js'), 'original');
    fs.writeFileSync(path.join(source, 'package.json'), '{"version":"5.0.0"}');
    fs.symlinkSync(source, installed);
    const stage = stageErgogen(installed, root);
    fs.writeFileSync(path.join(stage, 'src', 'ergogen.js'), 'patched');
    assert.equal(fs.readFileSync(path.join(source, 'src', 'ergogen.js'), 'utf8'), 'original');
    assert.notEqual(fs.realpathSync(stage), fs.realpathSync(installed));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
