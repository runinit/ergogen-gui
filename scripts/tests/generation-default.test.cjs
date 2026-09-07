const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('only explicit KiCad 5 produces the legacy warning', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/utils/generationHelpers.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: () => ({ isFeatureEnabled: () => true }) };
  vm.runInNewContext(code, context);
  for (const template of [undefined, 'kicad10', 'kicad8', 'kicad5']) {
    const warning = context.exports.checkForDeprecationWarnings({
      pcbs: { board: { template, footprints: { switch: { what: 'ceoloide/switch_choc_v1_v2' } } } },
    });
    if (template === 'kicad5') {
      assert.match(warning, /KiCad 5 is deprecated/);
    } else {
      assert.equal(warning, null);
    }
  }
});
