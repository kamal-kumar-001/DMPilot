// Tenant-isolation regression tests for the monitoring endpoints.
// Run: pnpm build && node test/monitoring-tenant-isolation.test.mjs
//
// Regression covered: previously GET /monitoring/webhook-logs and
// GET /monitoring/delivery-logs computed isStaff = (user.role === 'ADMIN')
// and skipped userId scoping for admins, so an admin's own user dashboard
// received EVERY user's webhook/delivery events. These endpoints must always
// scope to the caller. Cross-user aggregates live on /monitoring/admin/*.
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
  fn();
  passed += 1;
  console.log('ok -', name);
}

check('user webhook-logs: admin caller is scoped to own userId (isStaff=false)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getWebhookLogs(ADMIN, '2', '15');
  assert.equal(svc.calls.length, 1);
  assert.deepEqual(svc.calls[0], { method: 'getWebhookLogs', userId: 'admin-user-1', isStaff: false, page: 2, limit: 15 });
});

check('user webhook-logs: creator caller is scoped to own userId', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getWebhookLogs(CREATOR, undefined, undefined);
  assert.deepEqual(svc.calls[0], { method: 'getWebhookLogs', userId: 'creator-user-1', isStaff: false, page: 1, limit: 50 });
});

check('user delivery-logs: admin caller is scoped to own userId (isStaff=false)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getDeliveryLogs(ADMIN, '1', '50');
  assert.deepEqual(svc.calls[0], { method: 'getDeliveryLogs', userId: 'admin-user-1', isStaff: false, page: 1, limit: 50 });
});

check('user delivery-logs: creator caller is scoped to own userId', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getDeliveryLogs(CREATOR, undefined, undefined);
  assert.deepEqual(svc.calls[0], { method: 'getDeliveryLogs', userId: 'creator-user-1', isStaff: false, page: 1, limit: 50 });
});

check('admin webhook-logs route: aggregate preserved for the admin panel (isStaff=true)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getAdminWebhookLogs(ADMIN, '3', '25');
  assert.deepEqual(svc.calls[0], { method: 'getWebhookLogs', userId: 'admin-user-1', isStaff: true, page: 3, limit: 25 });
});

check('admin delivery-logs route: aggregate preserved for the admin panel (isStaff=true)', () => {
  const svc = mkService();
  const c = new MonitoringController(svc);
  c.getAdminDeliveryLogs(ADMIN, undefined, undefined);
  assert.deepEqual(svc.calls[0], { method: 'getDeliveryLogs', userId: 'admin-user-1', isStaff: true, page: 1, limit: 50 });
});

check('service-level: user scope applies when isStaff is false, aggregate when true', async () => {
  const { MonitoringService } = await import('../dist/monitoring/monitoring.service.js');
  const seen = [];
  const prisma = {
    instagramAccount: { findMany: async (args) => { seen.push({ op: 'accounts', args }); return [{ instagramId: 'ig-1', instagramPageId: null, username: 'fakeeiitian' }]; } },
    webhookEvent: {
      findMany: async (args) => { seen.push({ op: 'events', args }); return []; },
      count: async () => 0,
    },
  };
  const svc = new MonitoringService(prisma);
  await svc.getWebhookLogs('user-x', false, 1, 10);
  const scopedWhere = seen.find((s) => s.op === 'events').args.where;
  assert.ok(scopedWhere && Array.isArray(scopedWhere.OR), 'scoped query must filter to the caller accounts');
  seen.length = 0;
  await svc.getWebhookLogs('user-x', true, 1, 10);
  const aggWhere = seen.find((s) => s.op === 'events').args.where;
  assert.ok(aggWhere && Object.keys(aggWhere).length === 0, 'aggregate query must be unfiltered');
});

console.log('PASS', passed + '/7 monitoring tenant-isolation checks');
