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
const auditLog = { async log(e) { audit.push(e); return e; } };
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

// [5] mutate state while active, then disable restores the snapshot
await prisma.billingPlan.update({ where: { key: 'FREE' }, data: { campaignLimit: 99 } });
await prisma.featureFlag.update({ where: { key: 'test_flag' }, data: { isEnabled: false } });
threw = false;
try { await adminService.disableAppReviewMode('nope'); } catch (e) { threw = /Typed confirmation/.test(e.message); }
ok(threw, 'disable without typed confirm is rejected');
await adminService.disableAppReviewMode('RESTORE');
plan = await prisma.billingPlan.findUnique({ where: { key: 'FREE' } });
flag = await prisma.featureFlag.findUnique({ where: { key: 'test_flag' } });
ok(plan.campaignLimit === 1 && plan.keywordLimit === 3 && plan.dmLimitMonthly === 100, 'disable restores original plan limits');
ok(flag.isEnabled === false && flag.enabledForPlans === 'PRO', 'disable restores original flag state');
ok(audit.some((a) => a.action === 'ADMIN_DISABLE_APP_REVIEW_MODE'), 'disable is audit logged');

// [6] plan update audit carries before + after values
await adminService.updateBillingPlan('FREE', { campaignLimit: 5 });
const planAudit = audit.find((a) => a.action === 'ADMIN_PLAN_UPDATE');
ok(planAudit && JSON.parse(planAudit.details).before.campaignLimit === 1 && JSON.parse(planAudit.details).after.campaignLimit === 5, 'plan update audit carries before and after values');

// [7] flag toggle audit carries before + after values
await adminService.toggleFeatureFlag('test_flag', true);
const flagAudit = audit.find((a) => a.action === 'ADMIN_FLAG_TOGGLE');
ok(flagAudit && JSON.parse(flagAudit.details).before.isEnabled === false && JSON.parse(flagAudit.details).after.isEnabled === true, 'flag toggle audit carries before and after values');

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

console.log(`it-phase6: all ${pass} tests passed`);
await prisma.$disconnect();
