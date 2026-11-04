const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dmpilot-unit-'));
execFileSync(
  process.execPath,
  [
    require.resolve('typescript/bin/tsc'),
    'lib/session-transport.ts',
    'lib/polling.ts',
    '--outDir',
    out,
    '--module',
    'commonjs',
    '--target',
    'es2020',
    '--skipLibCheck',
  ],
  { cwd: path.resolve(__dirname, '..') },
);
process.on('exit', () => fs.rmSync(out, { recursive: true, force: true }));
const { createSessionTransport } = require(path.join(out, 'session-transport.js'));
const { startVisiblePolling } = require(path.join(out, 'polling.js'));

test('concurrent callers share one session read, reuse briefly, then refresh', async () => {
  let now = 0,
    calls = 0;
  const session = createSessionTransport(() => now);
  const load = async () => {
    calls++;
    return { accessToken: 'fixture-' + calls };
  };
  const values = await Promise.all(Array.from({ length: 8 }, () => session.get(load)));
  assert.equal(calls, 1);
  assert.equal(values[7].accessToken, 'fixture-1');
  now = 29_999;
  await session.get(load);
  assert.equal(calls, 1);
  now = 30_000;
  await session.get(load);
  assert.equal(calls, 2);
});
test('logout/account switch clear prevents old in-flight session from repopulating cache', async () => {
  const session = createSessionTransport();
  let release;
  const old = session.get(() => new Promise((r) => (release = r)));
  session.clear();
  await session.get(async () => ({ accessToken: 'new' }));
  release({ accessToken: 'old' });
  await assert.rejects(old, /Session changed/);
  assert.equal(
    (await session.get(async () => assert.fail('must reuse new value'))).accessToken,
    'new',
  );
});
test('session failures are not cached', async () => {
  const s = createSessionTransport();
  await assert.rejects(
    s.get(async () => {
      throw Error('offline');
    }),
  );
  assert.equal(await s.get(async () => 'recovered'), 'recovered');
});
test('polling skips hidden/overlap and refreshes on visibility resume, cleanup removes hooks', async () => {
  let tick,
    listener,
    calls = 0,
    release,
    cleared = false;
  const page = {
    hidden: false,
    addEventListener: (e, f) => (listener = f),
    removeEventListener: () => (listener = undefined),
  };
  const timers = { setInterval: (f) => ((tick = f), 1), clearInterval: () => (cleared = true) };
  const stop = startVisiblePolling(
    () => {
      calls++;
      return new Promise((r) => (release = r));
    },
    4000,
    page,
    timers,
  );
  tick();
  tick();
  assert.equal(calls, 1);
  release();
  await new Promise((r) => setImmediate(r));
  page.hidden = true;
  tick();
  assert.equal(calls, 1);
  page.hidden = false;
  listener();
  assert.equal(calls, 2);
  stop();
  release();
  await new Promise((r) => setImmediate(r));
  tick();
  assert.equal(calls, 2);
  assert.ok(cleared);
  assert.equal(listener, undefined);
});
test('poll errors release the in-flight lock', async () => {
  let tick,
    calls = 0;
  const p = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const stop = startVisiblePolling(
    async () => {
      calls++;
      throw Error('offline');
    },
    10,
    p,
    { setInterval: (f) => ((tick = f), 1), clearInterval() {} },
  );
  await new Promise((r) => setImmediate(r));
  tick();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 2);
  stop();
});
