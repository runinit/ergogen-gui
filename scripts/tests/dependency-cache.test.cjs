const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const routesForRelease = (version, base = '/') => {
  const routes = [];
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/service-worker.ts'),
    'utf8'
  );
  const code = ts.transpileModule(
    source.replaceAll('import.meta.env.BASE_URL', JSON.stringify(base)),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }
  ).outputText;
  class Strategy {
    constructor(options) {
      Object.assign(this, options);
    }
  }
  const noop = () => {};
  const workbox = {
    clientsClaim: noop,
    ExpirationPlugin: Strategy,
    precacheAndRoute: noop,
    createHandlerBoundToURL: (url) => ({ precacheUrl: url }),
    registerRoute: (match, strategy) => routes.push([match, strategy]),
    CacheFirst: Strategy,
    StaleWhileRevalidate: Strategy,
    NetworkFirst: Strategy,
    CacheableResponsePlugin: Strategy,
    initialize: noop,
  };
  vm.runInNewContext(code, {
    exports: {},
    process: { env: {} },
    URL,
    self: {
      addEventListener: noop,
      __WB_MANIFEST: [],
      location: { origin: 'https://example.com' },
    },
    require: (name) => (name.endsWith('package.json') ? { version } : workbox),
  });
  return routes;
};

const cacheForRelease = (version) =>
  routesForRelease(version).find(([match]) =>
    match({
      url: new URL('https://example.com/dependencies/extra.js'),
      request: { mode: 'cors' },
    })
  )[1].cacheName;

test('new releases cannot reuse the old dependency cache', () => {
  assert.notEqual(cacheForRelease('0.18.0'), cacheForRelease('0.19.0'));
});

test('revisioned viewer requests use the current precache', () => {
  const routes = routesForRelease('0.19.0');
  const request = { mode: 'cors' };
  const route = routes.find(([match]) =>
    match({
      url: new URL(
        'https://example.com/dependencies/kicanvas.js?v=new-release'
      ),
      request,
    })
  );
  assert.equal(route[1].precacheUrl, '/dependencies/kicanvas.js');
  assert.equal(
    route[0]({
      url: new URL(
        'https://other.example/dependencies/kicanvas.js?v=new-release'
      ),
      request,
    }),
    false
  );
});

for (const base of ['/ergogen-gui/', '/ergogen-gui-preview/']) {
  test(`offline assets resolve under ${base}`, () => {
    const routes = routesForRelease('0.20.0', base);
    const match = (file, mode = 'cors') =>
      routes.find(([predicate]) =>
        predicate({
          url: new URL(`https://example.com${base}${file}`),
          request: { mode },
        })
      );
    assert.equal(
      match('dependencies/kicanvas.js?v=current')?.[1].precacheUrl,
      `${base}dependencies/kicanvas.js`
    );
    assert.ok(match('dependencies/extra.js')?.[1].cacheName);
    assert.ok(match('assets/model.wasm')?.[1].cacheName);
    assert.equal(
      match('project/design', 'navigate')?.[1].precacheUrl,
      `${base}index.html`
    );
  });
}
