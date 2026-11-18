// Purge timeframe regression tests (monitoring.service.ts)
import assert from 'node:assert/strict';
import { MonitoringService } from '../dist/monitoring/monitoring.service.js';

let passed = 0;
function ok(name) { passed++; console.log(`  ${passed}. ${name}`); }

function makeService() {
  const calls = { deleteMany: [], jobRemove: 0 };
  const prisma = {
    webhookEvent: {
      async deleteMany(args) { calls.deleteMany.push(args); return { count: 3 }; },
    },
    queueJob: {
      async deleteMany(args) { calls.deleteMany.push(args); return { count: 2 }; },
    },
    systemSetting: { async findUnique() { return null; }, async upsert() { return {}; } },
  };
  const fakeQueue = {
    async getFailed() { return [{ timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, remove: async () => { calls.jobRemove++; } }]; },
  };
  const svc = Object.create(MonitoringService.prototype);
  svc.prisma = prisma;
  svc.mediaFetchQueue = fakeQueue;
  svc.sendDmQueue = fakeQueue;
  svc.logger = { log() {}, warn() {}, error() {}, setContext() {} };
  return { svc, calls };
}

// 1-4. valid timeframes scope deletes correctly
{
  const DAY = 24 * 60 * 60 * 1000;
  for (const [tf, expectedMs] of [['24h', DAY], ['1d', DAY], ['7d', 7 * DAY], ['30d', 30 * DAY]]) {
    const { svc, calls } = makeService();
    const before = Date.now();
    const r = await svc.purgeWebhookLogs(tf);
    const w = calls.deleteMany[0].where;
    assert.ok(w.createdAt?.lt instanceof Date);
    const cutoffMs = before - w.createdAt.lt.getTime();
    assert.ok(Math.abs(cutoffMs - expectedMs) < 5000, `${tf} cutoff off by ${cutoffMs - expectedMs}ms`);
    assert.equal(r.count, 3);
  }
  ok('24h/1d/7d/30d scope webhook-log deletes by createdAt cutoff');
}

// 5. explicit 'all' deletes without cutoff
{
  const { svc, calls } = makeService();
  const r = await svc.purgeWebhookLogs('all');
  assert.deepEqual(calls.deleteMany[0].where, {});
  assert.equal(r.count, 3);
  ok("explicit 'all' purges webhook logs without cutoff");
}

// 6. undefined timeframe refuses (previously deleted everything)
{
  const { svc, calls } = makeService();
  await assert.rejects(() => svc.purgeWebhookLogs(undefined), /Invalid purge timeframe/);
  assert.equal(calls.deleteMany.length, 0);
  ok('missing timeframe refuses webhook-log purge (no delete issued)');
}

// 7. malformed timeframe refuses
{
  const { svc, calls } = makeService();
  await assert.rejects(() => svc.purgeWebhookLogs('999d'), /Invalid purge timeframe/);
  await assert.rejects(() => svc.purgeWebhookLogs('all=true'), /Invalid purge timeframe/);
  assert.equal(calls.deleteMany.length, 0);
  ok('malformed timeframe refuses webhook-log purge (no delete issued)');
}

// 8. failed-jobs purge: valid timeframe scopes queue + DB deletes
{
  const { svc, calls } = makeService();
  const r = await svc.purgeFailedJobs('7d');
  const DAY = 24 * 60 * 60 * 1000;
  const w = calls.deleteMany[0].where;
  assert.equal(w.status, 'FAILED');
  assert.ok(w.createdAt?.lt instanceof Date);
  assert.equal(calls.jobRemove, 0); // test job is 2d old, within 7d cutoff
  assert.equal(r.count, 2);
  ok('failed-jobs purge: 7d scopes DB delete and skips newer failed jobs');
}

// 9. failed-jobs purge: invalid/missing timeframe refuses everything
{
  const { svc, calls } = makeService();
  await assert.rejects(() => svc.purgeFailedJobs(undefined), /Invalid purge timeframe/);
  await assert.rejects(() => svc.purgeFailedJobs('yesterday'), /Invalid purge timeframe/);
  assert.equal(calls.deleteMany.length, 0);
  assert.equal(calls.jobRemove, 0);
  ok('failed-jobs purge: missing/malformed timeframe refuses (no deletes)');
}

// 10. failed-jobs purge: explicit 'all' removes old failed jobs too
{
  const { svc, calls } = makeService();
  const r = await svc.purgeFailedJobs('all');
  assert.deepEqual(calls.deleteMany[0].where, { status: 'FAILED' });
  assert.equal(calls.jobRemove, 2); // both queues' jobs removed
  assert.equal(r.count, 4);
  ok("failed-jobs purge: explicit 'all' removes queue + DB records");
}

console.log(`purge-timeframe: all ${passed} tests passed`);
