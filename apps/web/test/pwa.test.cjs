const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
function worker() {
  const handlers = {},
    store = new Map();
  let calls = 0;
  const cache = {
    match: async (r) => store.get(typeof r === 'string' ? r : r.url),
    put: async (r, v) => store.set(r.url, v),
    addAll: async () => {},
  };
  const ctx = {
    URL,
    self: {
      location: { origin: 'https://app.invalid' },
      addEventListener: (e, f) => (handlers[e] = f),
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches: {
      open: async () => cache,
      match: async () => ({ offline: true }),
      keys: async () => [],
      delete: async () => {},
    },
    fetch: async () => {
      calls++;
      return {
        ok: true,
        clone() {
          return this;
        },
      };
    },
  };
  vm.runInNewContext(source, ctx);
  return { handlers, store, calls: () => calls };
}
test('private APIs and foreign/mutation requests bypass worker', () => {
  const w = worker();
  for (const [url, method] of [
    ['/api/auth/session', 'GET'],
    ['/api/billing', 'GET'],
    ['/dashboard', 'GET'],
    ['/api/messages', 'POST'],
    ['https://other.invalid/_next/static/x.js', 'GET'],
  ]) {
    let used = false;
    w.handlers.fetch({
      request: {
        url: url.startsWith('https') ? url : 'https://app.invalid' + url,
        method,
        mode: 'cors',
      },
      respondWith() {
        used = true;
      },
    });
    assert.equal(used, false);
  }
});
test('immutable build assets are cache first without a background re-fetch', async () => {
  const w = worker(),
    request = {
      url: 'https://app.invalid/_next/static/chunk-hash.js',
      method: 'GET',
      mode: 'cors',
    };
  let response;
  const e = {
    request,
    respondWith(p) {
      response = p;
    },
  };
  w.handlers.fetch(e);
  await response;
  w.handlers.fetch(e);
  await response;
  assert.equal(w.calls(), 1);
});
test('navigation is never saved to offline cache', async () => {
  const w = worker();
  let response;
  w.handlers.fetch({
    request: { url: 'https://app.invalid/dashboard', method: 'GET', mode: 'navigate' },
    respondWith(p) {
      response = p;
    },
  });
  await response;
  assert.equal(w.store.size, 0);
});
