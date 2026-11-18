// Phase-6 real-DB integration test: guarded App Review Mode (typed
// confirmation, snapshot + restore, before-values audit), plan/flag audit
// before-values, audit-log purge confirmation, and admin-route role matrix
// (API keys and non-admin roles denied).
// Requires TEST_DATABASE_URL pointing at a scratch database, with the schema
// already pushed and the api built:
//   pnpm --filter @dmpilot/api build
//   TEST_DATABASE_URL=postgresql://... node test/it-phase6.test.mjs
// scripts/run-integration-tests.mjs does all of this against a disposable
// embedded Postgres.
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL to a scratch Postgres to run the real-DB integration test');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { AdminService } = await import('../dist/admin/admin.service.js');
const { JwtAuthGuard } = await import('../dist/auth/guards/jwt-auth.guard.js');
const { RolesGuard } = await import('../dist/auth/guards/roles.guard.js');
const { ApiKeyService } = await import('../dist/auth/api-key.service.js');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });

let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };

const audit = [];
const auditLog = { async log(e) { audit.push(e); await prisma.auditLog.create({ data: { action: e.action, details: e.details } }); return e; } };
const featureFlagService = {
  async toggle(key, isEnabled) {
    return prisma.featureFlag.update({ where: { key }, data: { isEnabled } });
  },
  async updatePlans(key, plans) {
    return prisma.featureFlag.update({ where: { key }, data: { enabledForPlans: plans.join(',') } });
  },
};
const monitoringService = {};
const adminService = new AdminService(prisma, featureFlagService, monitoringService, auditLog);

// fixtures: one plan with limited quotas, one flag partially disabled
await prisma.billingPlan.create({
  data: { key: 'FREE', name: 'Free', campaignLimit: 1, keywordLimit: 3, dmLimitMonthly: 100, accountLimit: 1 },
});
await prisma.featureFlag.create({
  data: { key: 'test_flag', description: 't', isEnabled: false, enabledForPlans: 'PRO' },
});

// [1] enable requires the typed phrase
let threw = false;
try { await adminService.enableAppReviewMode('yes'); } catch (e) { threw = /Typed confirmation/.test(e.message); }
ok(threw, 'enable-app-review-mode without typed confirm is rejected');

// [2] enable snapshots before-values, then applies unlimited quotas
await adminService.enableAppReviewMode('ENABLE APP REVIEW');
let plan = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
let flag = await prisma.featureFlag.findUnique({ where: { key: 'test_flag' } });
ok(plan.campaignLimit === -1 && plan.keywordLimit === -1 && plan.dmLimitMonthly === -1, 'enable sets plan quotas unlimited');
ok(flag.isEnabled === true && flag.enabledForPlans === 'FREE,PRO,ENTERPRISE', 'enable turns all flags on for all plans');
const snapshot = await prisma.appReviewSnapshot.findFirst({ where: { restoredAt: null } });
ok(!!snapshot, 'snapshot row stored before mutation');
const snapPlans = JSON.parse(snapshot.plansJson);
ok(snapPlans[0].campaignLimit === 1 && snapPlans[0].keywordLimit === 3 && snapPlans[0].dmLimitMonthly === 100, 'snapshot captured original plan limits');
const enableAudit = audit.find((a) => a.action === 'ADMIN_ENABLE_APP_REVIEW_MODE');
ok(enableAudit && JSON.parse(enableAudit.details).before.plans[0].campaignLimit === 1, 'enable audit log carries before-values');

// [3] double enable is refused while active
threw = false;
try { await adminService.enableAppReviewMode('ENABLE APP REVIEW'); } catch (e) { threw = /already active/.test(e.message); }
ok(threw, 'second enable refused while a snapshot is active');

// [4] status reflects active snapshot
const status = await adminService.getAppReviewStatus();
ok(status.active === true && status.snapshotId === snapshot.id, 'status endpoint reports active snapshot');

// [5] disable requires typed confirm; post-snapshot edits refuse restore (no blind overwrite)
threw = false;
try { await adminService.disableAppReviewMode('nope'); } catch (e) { threw = /Typed confirmation/.test(e.message); }
ok(threw, 'disable without typed confirm is rejected');
await prisma.billingPlan.update({ where: { key: 'FREE' }, data: { campaignLimit: 99 } });
await prisma.featureFlag.update({ where: { key: 'test_flag' }, data: { isEnabled: false } });
threw = false;
try { await adminService.disableAppReviewMode('RESTORE'); } catch (e) { threw = /Restore refused/.test(e.message); }
ok(threw, 'restore refused when plans/flags changed after snapshot');
plan = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
ok(plan.campaignLimit === 99, 'refused restore leaves legitimate edits untouched');
// admin resolves drift back to the enabled state, then restore succeeds
await prisma.billingPlan.update({ where: { key: 'FREE' }, data: { campaignLimit: -1, keywordLimit: -1, dmLimitMonthly: -1 } });
await prisma.featureFlag.update({ where: { key: 'test_flag' }, data: { isEnabled: true, enabledForPlans: 'FREE,PRO,ENTERPRISE' } });
await adminService.disableAppReviewMode('RESTORE');
plan = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
flag = await prisma.featureFlag.findUnique({ where: { key: 'test_flag' } });
ok(plan.campaignLimit === 1 && plan.keywordLimit === 3 && plan.dmLimitMonthly === 100, 'restore succeeds after drift resolved, original limits back');
ok(flag.isEnabled === false && flag.enabledForPlans === 'PRO', 'restore brings back original flag state');
ok(audit.some((a) => a.action === 'ADMIN_DISABLE_APP_REVIEW_MODE'), 'disable is audit logged');
// repeated restore refused
threw = false;
try { await adminService.disableAppReviewMode('RESTORE'); } catch (e) { threw = /not active/.test(e.message); }
ok(threw, 'repeated restore refused (no active snapshot)');

// [6] plan update audit carries before + after values
let threw2 = false;
try { await adminService.updateBillingPlan('FREE', undefined, { campaignLimit: 5 }); } catch (e) { threw2 = /confirmation mismatch/.test(e.message); }
ok(threw2, 'plan update without confirmKey is rejected server-side');
await adminService.updateBillingPlan('FREE', 'FREE', { campaignLimit: 5 });
const planAudit = audit.find((a) => a.action === 'ADMIN_PLAN_UPDATE');
ok(planAudit && JSON.parse(planAudit.details).before.campaignLimit === 1 && JSON.parse(planAudit.details).after.campaignLimit === 5, 'plan update audit carries before and after values');

// [7] flag toggle audit carries before + after values
await adminService.toggleFeatureFlag('test_flag', true);
const flagAudit = audit.find((a) => a.action === 'ADMIN_FLAG_TOGGLE');
ok(flagAudit && JSON.parse(flagAudit.details).before.isEnabled === false && JSON.parse(flagAudit.details).after.isEnabled === true, 'flag toggle audit carries before and after values');

// [7b] concurrent enable: exactly one wins, loser is refused, snapshot holds original values
await adminService.enableAppReviewMode('ENABLE APP REVIEW');
await adminService.disableAppReviewMode('RESTORE');
const concurrent = await Promise.allSettled([
  adminService.enableAppReviewMode('ENABLE APP REVIEW'),
  adminService.enableAppReviewMode('ENABLE APP REVIEW'),
]);
const winners = concurrent.filter((r) => r.status === 'fulfilled').length;
ok(winners === 1, `concurrent enable: exactly one succeeds (${winners})`);
const activeSnap = await prisma.appReviewSnapshot.findFirst({ where: { restoredAt: null } });
ok(JSON.parse(activeSnap.plansJson)[0].campaignLimit === 5, 'snapshot holds pre-enable values, not mutated state');
await adminService.disableAppReviewMode('RESTORE');


// [8] audit-log purge requires typed confirm and logs the purged count
await prisma.auditLog.createMany({ data: [
  { action: 'OLD', createdAt: new Date(Date.now() - 40 * 86400000) },
  { action: 'RECENT' },
] });
threw = false;
try { await adminService.purgeAuditLogs({ before: new Date(Date.now() - 30 * 86400000).toISOString(), confirm: 'sure' }); } catch (e) { threw = /Typed confirmation/.test(e.message); }
ok(threw, 'log purge without typed confirm is rejected');
const purgeResult = await adminService.purgeAuditLogs({ before: new Date(Date.now() - 30 * 86400000).toISOString(), confirm: 'PURGE' });
ok(purgeResult.count === 1, `purge removed exactly the old rows (${purgeResult.count})`);
ok(audit.some((a) => a.action === 'ADMIN_AUDIT_LOG_PURGE' && JSON.parse(a.details).purgedCount === 1), 'purge audit log records count and timeframe');
const beforeAll = await prisma.auditLog.count();
await adminService.purgeAuditLogs({ all: true, confirm: 'PURGE' });
const afterAll = await prisma.auditLog.count();
ok(afterAll === 1 && beforeAll >= 1, `purge all deletes history but keeps its own audit entry (${beforeAll} -> ${afterAll})`);

// [9] role matrix: API keys can never reach admin routes, non-admin roles denied
const crypto = await import('node:crypto');
const apiKeyService = new ApiKeyService(prisma, auditLog);
const adminUser = await prisma.user.create({ data: { email: `p6-${Date.now()}@example.test`, password: 'x', name: 'a', isVerified: true, role: 'ADMIN' } });
const rawKey = 'dmp_live_' + crypto.randomBytes(24).toString('hex');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
await prisma.apiKey.create({ data: { userId: adminUser.id, name: 'k', keyHash, prefix: 'x', scopes: ['read', 'write'], expiresAt: new Date(Date.now() + 86400000) } });
const reflectorNoScopes = { getAllAndOverride: () => undefined };
const jwtGuard = new JwtAuthGuard(apiKeyService, reflectorNoScopes);
const mkCtx = (method, path) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-api-key': rawKey }, method, path, url: path, params: {}, body: {}, query: {} }) }),
  getHandler: () => ({}), getClass: () => ({}),
});
let keyDenied = false;
try { await jwtGuard.canActivate(mkCtx('GET', '/admin/creators')); } catch { keyDenied = true; }
ok(keyDenied, 'admin-owned API key is denied on admin routes (fail closed, no @RequiresScopes)');

const rolesGuard = new RolesGuard({ getAllAndOverride: () => ['ADMIN'] });
const mkRoleCtx = (role) => ({ switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }), getHandler: () => ({}), getClass: () => ({}) });
ok(rolesGuard.canActivate(mkRoleCtx('CREATOR')) === false, 'creator role denied by RolesGuard on admin routes');
ok(rolesGuard.canActivate(mkRoleCtx('ADMIN')) === true, 'admin role passes RolesGuard');

// [9b] full guard chain on an admin route: no token -> 401, creator JWT -> denied, admin JWT -> pass, admin API key -> denied
const runChain = async (headers, user) => {
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ headers, method: 'POST', path: '/admin/delete-requests/approve', url: '/admin/delete-requests/approve', params: {}, body: {}, query: {}, user, ...(headers['x-api-key'] ? {} : {}) }) }),
    getHandler: () => ({}), getClass: () => ({}),
  };
  try {
    const jwtOk = await jwtGuard.canActivate(ctx);
    if (!jwtOk) return false;
    return rolesGuard.canActivate(ctx);
  } catch {
    return false;
  }
};
ok((await runChain({}, undefined)) === false, 'no token denied on destructive admin route');
ok((await runChain({ authorization: 'Bearer not-a-key' }, { role: 'CREATOR' })) === false, 'creator denied on destructive admin route');
const apiKeyCtx = { headers: { 'x-api-key': rawKey } };
ok((await runChain(apiKeyCtx.headers, undefined)) === false, 'admin-owned API key denied on destructive admin route');


try {
// [10] route-level guard matrix over the real AdminController HTTP stack:
// no-token, API key, creator JWT, admin JWT, and a destructive endpoint.
const { NestFactory } = await import('@nestjs/core');
const { Module } = await import('@nestjs/common');
const { PassportModule } = await import('@nestjs/passport');
const { JwtModule, JwtService } = await import('@nestjs/jwt');
const { AdminController } = await import('../dist/admin/admin.controller.js');
const { JwtStrategy } = await import('../dist/auth/strategies/jwt.strategy.js');
const { ConfigService } = await import('../dist/config/config.service.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { FeatureFlagService } = await import('../dist/billing/feature-flag.service.js');
const { MonitoringService } = await import('../dist/monitoring/monitoring.service.js');
const { AuditLogService } = await import('../dist/auth/audit-log.service.js');
const { EmailAutomationsService } = await import('../dist/admin/email-automations.service.js');
const { ServiceAccessService } = await import('../dist/billing/service-access.service.js');
const { CouponService } = await import('../dist/billing/coupon.service.js');
const { TesterAccessService } = await import('../dist/instagram/tester-access.service.js');

const creatorUser = await prisma.user.create({ data: { email: `p6-creator-${Date.now()}@example.test`, password: 'x', name: 'c', isVerified: true, role: 'CREATOR' } });

class HttpMatrixModule {}
Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: 'it-secret', signOptions: { expiresIn: '1h' } }),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    JwtStrategy,
    { provide: PrismaService, useValue: prisma },
    { provide: ConfigService, useValue: { get: (k) => (k === 'JWT_SECRET' ? 'it-secret' : '') } },
    { provide: FeatureFlagService, useValue: featureFlagService },
    { provide: MonitoringService, useValue: monitoringService },
    { provide: AuditLogService, useValue: auditLog },
    { provide: ApiKeyService, useValue: apiKeyService },
    { provide: EmailAutomationsService, useValue: {} },
    { provide: ServiceAccessService, useValue: { list: async () => [] } },
    { provide: CouponService, useValue: {} },
    { provide: TesterAccessService, useValue: {} },
  ],
})(HttpMatrixModule);

const app = await NestFactory.create(HttpMatrixModule, { logger: false });
console.log('[10] app created');
await app.listen(0, '127.0.0.1');
const port = app.getHttpServer().address().port;
const base = `http://127.0.0.1:${port}`;
const jwtService = app.get(JwtService);
const mkTok = (u) => jwtService.sign({ sub: u.id, email: u.email, role: u.role });

let r = await fetch(`${base}/admin/creators`);
ok(r.status === 401, `route matrix: no token rejected (${r.status})`);
r = await fetch(`${base}/admin/creators`, { headers: { 'x-api-key': rawKey } });
ok(r.status === 401 || r.status === 403, `route matrix: API key can never reach admin routes (${r.status})`);
r = await fetch(`${base}/admin/creators`, { headers: { authorization: `Bearer ${mkTok(creatorUser)}` } });
ok(r.status === 403, `route matrix: creator role denied (${r.status})`);
r = await fetch(`${base}/admin/creators`, { headers: { authorization: `Bearer ${mkTok(adminUser)}` } });
ok(r.status === 200, `route matrix: admin reaches admin routes (${r.status})`);
r = await fetch(`${base}/admin/enable-app-review-mode`, {
  method: 'POST', headers: { authorization: `Bearer ${mkTok(adminUser)}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'wrong' }),
});
ok(r.status === 400, `route matrix: destructive endpoint enforces typed confirm over HTTP (${r.status})`);
r = await fetch(`${base}/admin/creators`, { headers: { authorization: `Bearer ${mkTok(creatorUser)}`, 'x-api-key': rawKey } });
ok(r.status !== 200, `route matrix: API key + creator token still denied (${r.status})`);
await app.close();
} catch (e) {
  console.error('[10] HTTP matrix failed:', e && (e.stack || e.message || e));
  process.exit(1);
}


// [11] mid-transaction failure rolls back enable and restore (no partial writes)
const mkTxSaboteur = (model) => new Proxy(prisma, {
  get(target, prop, recv) {
    if (prop === '$transaction') {
      return (fn, opts) => target.$transaction(async (tx) => {
        const txProxy = new Proxy(tx, {
          get(t2, p2) {
            if (p2 === model) {
              return { ...t2[model], updateMany: async () => { throw new Error('injected mid-tx failure'); } };
            }
            return Reflect.get(t2, p2);
          },
        });
        return fn(txProxy);
      }, opts);
    }
    return Reflect.get(target, prop, recv);
  },
});
const beforeEnable = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
const saboteurEnable = new AdminService(mkTxSaboteur('featureFlag'), featureFlagService, monitoringService, auditLog);
threw = false;
try { await saboteurEnable.enableAppReviewMode('ENABLE APP REVIEW'); } catch (e) { threw = /injected/.test(e.message); }
ok(threw, 'enable failure injection: mid-tx error surfaces');
ok((await prisma.appReviewSnapshot.count({ where: { restoredAt: null } })) === 0, 'failed enable leaves no active snapshot (rolled back)');
let planNow = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
ok(planNow.campaignLimit === beforeEnable.campaignLimit && planNow.keywordLimit === beforeEnable.keywordLimit, 'failed enable leaves plan limits unchanged (rolled back)');

await adminService.enableAppReviewMode('ENABLE APP REVIEW');
const saboteurDisable = new AdminService(mkTxSaboteur('billingPlan'), featureFlagService, monitoringService, auditLog);
threw = false;
try { await saboteurDisable.disableAppReviewMode('RESTORE'); } catch (e) { threw = /injected/.test(e.message); }
ok(threw, 'restore failure injection: mid-tx error surfaces');
ok((await prisma.appReviewSnapshot.count({ where: { restoredAt: null } })) === 1, 'failed restore keeps snapshot active (rolled back)');
planNow = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
ok(planNow.campaignLimit === -1, 'failed restore leaves unlimited state in place (rolled back)');
await adminService.disableAppReviewMode('RESTORE');
planNow = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
ok(planNow.campaignLimit === beforeEnable.campaignLimit, 'restore succeeds after injected failure cleared');

// [12] purge timeframe validation is fail-closed
threw = false;
try { await adminService.purgeAuditLogs({ confirm: 'PURGE' }); } catch (e) { threw = /Invalid date/.test(e.message); }
ok(threw, 'purge with missing timeframe is refused (no silent delete-all)');
threw = false;
try { await adminService.purgeAuditLogs({ before: 'not-a-date', confirm: 'PURGE' }); } catch (e) { threw = /Invalid date/.test(e.message); }
ok(threw, 'purge with malformed timeframe is refused');
const recentBefore = await prisma.auditLog.count();
const purgeFuture = await adminService.purgeAuditLogs({ before: new Date(Date.now() + 60000).toISOString(), confirm: 'PURGE' });
ok(purgeFuture.count === recentBefore, `purge with future timeframe deletes exactly the matching rows (${purgeFuture.count})`);
ok((await prisma.auditLog.count()) === 1, 'purge entry written after delete always survives');

console.log(`it-phase6: all ${pass} tests passed`);
await prisma.$disconnect();
