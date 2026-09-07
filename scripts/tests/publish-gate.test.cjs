const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

test('Pages deploys only the checked artifact without overrides', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../.github/workflows/deploy.yaml'), 'utf8');
  const { jobs } = yaml.load(source);

  assert.equal(jobs.deploy?.needs, 'check');
  const steps = jobs.check.steps;
  const commands = steps.map((step) => step.run || '').join('\n');
  for (const command of ['test:release', 'precommit', 'run build', 'test:e2e']) {
    assert.ok(commands.includes(command), `Missing gate: ${command}`);
  }
  assert.ok(steps.at(-1).uses.startsWith('actions/upload-pages-artifact@'));
  assert.ok(jobs.deploy.steps.some((step) => step.uses?.startsWith('actions/deploy-pages@')));
  assert.doesNotMatch(source, /vars\.(ERGOGEN_VERSION|PUBLIC_URL|CNAME_DOMAIN)/);
});
