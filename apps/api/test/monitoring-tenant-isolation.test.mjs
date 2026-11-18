// Tenant-isolation regression tests for the monitoring endpoints.
// Run: pnpm build && node test/monitoring-tenant-isolation.test.mjs
//
// Regression covered: previously GET /monitoring/webhook-logs and
// GET /monitoring/delivery-logs computed isStaff = (user.role === 'ADMIN')
// and skipped userId scoping for admins, so an admin's own user dashboard
// received EVERY user's webhook/delivery events. These endpoints must always
// scope to the caller. Cross-user aggregates live on /monitoring/admin/*.
//
// Second regression covered: scoping must rely only on immutable RECIPIENT
// identity (payload.entry[].id owned exclusively by the caller). Usernames
// (mutable, colliding) and senderId (counterparty, not tenant) never scope.
import assert from 'node:assert/strict';

// The controller uses decorators; import the compiled output (pnpm build first).
const { MonitoringController } = await import('../dist/monitoring/monitoring.controller.js');

function mkService() {
  const calls = [];
  return {
    calls,
    getWebhookLogs(userId, isStaff, page, limit) {
      calls.push({ method: 'getWebhookLogs', userId, isStaff, page, limit });
      return { logs: [], total: 0 };
    },
    getDeliveryLogs(userId, isStaff, page, limit) {
      calls.push({ method: 'getDeliveryLogs', userId, isStaff, page, limit });
      return { logs: [], total: 0 };
    },
  };
}

const ADMIN = { id: 'admin-user-1', role: 'ADMIN' };
const CREATOR = { id: 'creator-user-1', role: 'USER' };

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('ok -', name);
    });
}

await check('user webhook-logs: admin caller is scoped to own userId (isStaff=false)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getWebhookLogs(ADMIN, '2', '15');
  assert.equal(svc.calls.length, 1);
  assert.deepEqual(svc.calls[0], { method: 'getWebhookLogs', userId: 'admin-user-1', isStaff: false, page: 2, limit: 15 });
});

await check('user webhook-logs: creator caller is scoped to own userId', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getWebhookLogs(CREATOR, undefined, undefined);
  assert.deepEqual(svc.calls[0], { method: 'getWebhookLogs', userId: 'creator-user-1', isStaff: false, page: 1, limit: 50 });
});

await check('user delivery-logs: admin caller is scoped to own userId (isStaff=false)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getDeliveryLogs(ADMIN, '1', '50');
  assert.deepEqual(svc.calls[0], { method: 'getDeliveryLogs', userId: 'admin-user-1', isStaff: false, page: 1, limit: 50 });
});

await check('user delivery-logs: creator caller is scoped to own userId', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getDeliveryLogs(CREATOR, undefined, undefined);
  assert.deepEqual(svc.calls[0], { method: 'getDeliveryLogs', userId: 'creator-user-1', isStaff: false, page: 1, limit: 50 });
});

await check('admin webhook-logs route: aggregate preserved for the admin panel (isStaff=true)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getAdminWebhookLogs(ADMIN, '3', '25');
  assert.deepEqual(svc.calls[0], { method: 'getWebhookLogs', userId: 'admin-user-1', isStaff: true, page: 3, limit: 25 });
});

await check('admin delivery-logs route: aggregate preserved for the admin panel (isStaff=true)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getAdminDeliveryLogs(ADMIN, undefined, undefined);
  assert.deepEqual(svc.calls[0], { method: 'getDeliveryLogs', userId: 'admin-user-1', isStaff: true, page: 1, limit: 50 });
});

// ── service-level scoping shape (raw SQL path) ────────────────────────────

async function mkScopeService(accounts, opts = {}) {
  const { MonitoringService } = await import('../dist/monitoring/monitoring.service.js');
  const seen = { raw: [], findMany: [] };
  const prisma = {
    instagramAccount: { findMany: async () => accounts },
    webhookEvent: {
      findMany: async (args) => { seen.findMany.push(args); return []; },
      count: async () => 0,
    },
    $queryRawUnsafe: async (sql, ...values) => {
      seen.raw.push({ sql, values });
      return sql.trimStart().toUpperCase().startsWith('SELECT COUNT') ? [{ count: '0' }] : [];
    },
  };
  if (opts.aliasModel) prisma.instagramAccountAlias = opts.aliasModel;
  return { svc: new MonitoringService(prisma), seen };
}

await check('service-level: scoped path uses entry-attribution SQL, aggregate path stays unfiltered', async () => {
  const { svc, seen } = await mkScopeService([{ userId: 'user-x', instagramId: 'ig-1', instagramPageId: null }]);
  await svc.getWebhookLogs('user-x', false, 1, 10);
  assert.equal(seen.raw.length, 2, 'list + count raw queries');
  assert.ok(seen.raw[0].sql.includes('jsonb_array_elements'), 'entry attribution via jsonb');
  assert.ok(seen.raw[0].sql.includes('NOT EXISTS'), 'fail-closed on mixed entries');
  assert.deepEqual(seen.raw[0].values[0], ['ig-1']);
  seen.raw.length = 0;
  await svc.getWebhookLogs('user-x', true, 1, 10);
  assert.equal(seen.raw.length, 0, 'aggregate path must not use scoped raw SQL');
  assert.deepEqual(seen.findMany[0].where, {}, 'aggregate query unfiltered');
});

await check('tenant scope: username never scopes (WHERE has no username predicate)', async () => {
  const { svc, seen } = await mkScopeService([
    { userId: 'user-a', instagramId: 'id-a', instagramPageId: null },
    { userId: 'user-b', instagramId: 'id-b', instagramPageId: null },
  ]);
  await svc.getWebhookLogs('user-a', false, 1, 10);
  const sql = seen.raw[0].sql;
  assert.ok(!/username\s*(=|IN)/i.test(sql), 'no username predicate');
  assert.deepEqual(seen.raw[0].values[0], ['id-a'], 'only caller-owned ids');
});

await check('tenant scope: senderId never scopes (counterparty, not tenant)', async () => {
  const { svc, seen } = await mkScopeService([{ userId: 'user-a', instagramId: 'ig-1', instagramPageId: null }]);
  await svc.getWebhookLogs('user-a', false, 1, 10);
  assert.ok(!/senderId\s*(=|IN)/i.test(seen.raw[0].sql), 'no senderId predicate');
});

await check('tenant scope: soft-deleted predecessor ids still attribute to the same user', async () => {
  const { svc, seen } = await mkScopeService([
    { userId: 'user-a', instagramId: 'igsid-a', instagramPageId: null },
    { userId: 'user-a', instagramId: 'old-a', instagramPageId: 'page-a' },
  ]);
  await svc.getWebhookLogs('user-a', false, 1, 10);
  assert.deepEqual(new Set(seen.raw[0].values[0]), new Set(['igsid-a', 'old-a', 'page-a']));
});

await check('tenant scope: identifier shared with another user fails closed (excluded for both)', async () => {
  const { svc, seen } = await mkScopeService([
    { userId: 'user-a', instagramId: 'shared-id', instagramPageId: null },
    { userId: 'user-b', instagramId: 'shared-id', instagramPageId: null },
    { userId: 'user-a', instagramId: 'solo-a', instagramPageId: null },
  ]);
  await svc.getWebhookLogs('user-a', false, 1, 10);
  assert.deepEqual(seen.raw[0].values[0], ['solo-a']);
});

await check('tenant scope: alias identifiers union in when the alias table is deployed (rollout-order safe)', async () => {
  const aliasModel = { findMany: async () => [{ identifier: 'alias-old-ns' }] };
  const { svc, seen } = await mkScopeService(
    [{ userId: 'user-a', instagramId: 'igsid-a', instagramPageId: null }],
    { aliasModel },
  );
  await svc.getWebhookLogs('user-a', false, 1, 10);
  assert.deepEqual(new Set(seen.raw[0].values[0]), new Set(['igsid-a', 'alias-old-ns']));
});

await check('tenant scope: missing alias model is tolerated (dashboard ships before alias table)', async () => {
  const { svc, seen } = await mkScopeService([{ userId: 'user-a', instagramId: 'ig-1', instagramPageId: null }]);
  await svc.getWebhookLogs('user-a', false, 1, 10);
  assert.deepEqual(seen.raw[0].values[0], ['ig-1']);
});

await check('tenant scope: user with no accounts gets an empty page, never an unfiltered query', async () => {
  const { svc, seen } = await mkScopeService([]);
  const res = await svc.getWebhookLogs('user-a', false, 1, 10);
  assert.deepEqual(res, { logs: [], total: 0, page: 1, limit: 10 });
  assert.equal(seen.raw.length + seen.findMany.length, 0, 'no event query may run without owned identifiers');
});

console.log('PASS', passed + '/14 monitoring tenant-isolation checks');
