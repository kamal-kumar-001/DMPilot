import assert from 'node:assert/strict';
import { AdminService } from '../dist/admin/admin.service.js';
const originalFetch = globalThis.fetch;
const SHA = 'd53265b410cf69b90594189d5d179f072065b898';
let calls = 0;
try {
  const service = new AdminService(null, null, null, null);
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/kamal-kumar-001/DMPilot/commits/main');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    assert.equal(options.headers.Authorization, undefined);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { ok: true, json: async () => ({ sha: SHA, extra: 'never forwarded' }) };
  };
  const [a, b] = await Promise.all([
    service.getLatestDeployCommit(),
    service.getLatestDeployCommit(),
  ]);
  assert.equal(a.sha, SHA);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  assert.equal(a.repository, 'kamal-kumar-001/DMPilot');
  assert.equal(a.branch, 'main');
  assert.equal(a.extra, undefined);
  await service.getLatestDeployCommit();
  assert.equal(calls, 1);
  for (const result of [{ ok: false }, { ok: true, json: async () => ({ sha: 'bad' }) }]) {
    const fresh = new AdminService(null, null, null, null);
    globalThis.fetch = async () => result;
    await assert.rejects(() => fresh.getLatestDeployCommit(), /unavailable/);
  }
  const recovery = new AdminService(null, null, null, null);
  globalThis.fetch = async () => {
    throw new Error('private credential detail');
  };
  await assert.rejects(
    () => recovery.getLatestDeployCommit(),
    (e) => !e.message.includes('credential'),
  );
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ sha: SHA }) });
  assert.equal((await recovery.getLatestDeployCommit()).sha, SHA);
  console.log(
    'PASS latest-main fixed URL, single-flight, cache, validation, failure recovery and safe error',
  );
} finally {
  globalThis.fetch = originalFetch;
}
