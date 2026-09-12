const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const yaml = require('js-yaml');

const root = path.join(__dirname, '../..');
test('checks the exact vendored archive without requiring an npm publication', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const archive = path.join(root, pkg.dependencies.ergogen.replace(/^file:/, ''));
  const engine = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], {encoding: 'utf8'}));
  const policy = yaml.load(fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8'));
  assert.deepEqual(policy.minimumReleaseAgeExclude, [`${engine.name}@${engine.version}`]);
  const hash = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  assert.ok(fs.readFileSync(path.join(root, 'vendor/README.md'), 'utf8').includes(hash));
});
