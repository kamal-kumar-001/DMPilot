// Phase-7 real-DB integration test: safe update control (deploy requests).
// Owner-only exact-commit requests, single active request, watcher claim/
// report contract, expiry, scope denials, forced audit during logging pause.
// Requires TEST_DATABASE_URL (scratch DB, schema pushed, api built).
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { AdminService } = await import('../dist/admin/admin.service.js');
const { AuditLogService } = await import('../dist/auth/audit-log.service.js');
const { ApiKeyService } = await import('../dist/auth/api-key.service.js');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });

let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };

process.env.DEPLOY_OWNER_USER_ID = 'owner-admin-1';
const realAudit = new AuditLogService(prisma);
const ff = { async toggle() {}, async updatePlans() {} };
const adminService = new AdminService(prisma, ff, {}, realAudit);
const SHA = 'a'.repeat(40);
const SHA2 = 'b'.repeat(40);

// owner + non-owner users
await prisma.user.create({ data: { id: 'owner-admin-1', email: `p7-owner-${Date.now()}@example.test`, password: 'x', name: 'o', isVerified: true, role: 'ADMIN' } });
const otherAdmin = await prisma.user.create({ data: { email: `p7-other-${Date.now()}@example.test`, password: 'x', name: 'o2', isVerified: true, role: 'ADMIN' } });

// [1] typed confirm + sha format + owner binding
let threw = false;
try { await adminService.createDeployRequest('owner-admin-1', SHA, 'nope'); } catch (e) { threw = /Typed confirmation/.test(e.message); }
ok(threw, 'create without typed DEPLOY confirm is rejected');
threw = false;
try { await adminService.createDeployRequest('owner-admin-1', 'abc123', 'DEPLOY'); } catch (e) { threw = /40-character/.test(e.message); }
ok(threw, 'create with short/invalid SHA is rejected');
threw = false;
try { await adminService.createDeployRequest(otherAdmin.id, SHA, 'DEPLOY'); } catch (e) { threw = /owner admin/.test(e.message); }
ok(threw, 'non-owner admin cannot create a deploy request');
const req1 = await adminService.createDeployRequest('owner-admin-1', SHA, 'DEPLOY');
ok(req1.status === 'REQUESTED' && req1.targetSha === SHA, 'owner creates a pinned deploy request');

// [2] single active request; cancel releases the slot
threw = false;
try { await adminService.createDeployRequest('owner-admin-1', SHA2, 'DEPLOY'); } catch (e) { threw = /already active/.test(e.message); }
ok(threw, 'second concurrent request refused');
threw = false;
try { await adminService.cancelDeployRequest(otherAdmin.id, req1.id); } catch (e) { threw = /owner admin/.test(e.message); }
ok(threw, 'non-owner cannot cancel');
const canceled = await adminService.cancelDeployRequest('owner-admin-1', req1.id);
ok(canceled.status === 'CANCELED', 'owner can cancel a pending request');
const req2 = await adminService.createDeployRequest('owner-admin-1', SHA, 'DEPLOY');
ok(req2.status === 'REQUESTED', 'new request allowed after cancel');

// [3] claim: owner-binding rechecked, runId assigned, double-claim refused
const claimed = await adminService.claimNextDeployRequest();
ok(claimed.status === 'CLAIMED' && claimed.runId, 'watcher claims the request with a fresh runId');
threw = false;
try { await adminService.claimNextDeployRequest(); } catch (e) { threw = /already active/.test(e.message); }
ok(threw, 'second claim refused while a run is active');
threw = false;
try { await adminService.cancelDeployRequest('owner-admin-1', req2.id); } catch (e) { threw = /claimed\/running/.test(e.message); }
ok(threw, 'cancel of a claimed request refused (no fail-open)');

// [4] report transitions and stale runId
threw = false;
try { await adminService.reportDeployRequest(req2.id, 'wrong-run', { action: 'START' }); } catch (e) { threw = /runId/.test(e.message); }
ok(threw, 'report with wrong runId rejected');
const running = await adminService.reportDeployRequest(req2.id, claimed.runId, { action: 'START' });
ok(running.status === 'RUNNING', 'report START moves to RUNNING');
threw = false;
try { await adminService.reportDeployRequest(req2.id, claimed.runId, { action: 'SUCCESS' }); } catch (e) { threw = e; }
ok(threw === false, 'report SUCCESS from RUNNING accepted');
threw = false;
try { await adminService.reportDeployRequest(req2.id, claimed.runId, { action: 'FAIL' }); } catch (e) { threw = /Invalid report action/.test(e.message); }
ok(threw, 're-report on a finished request refused');

// [5] expiry: old REQUESTED expires, never claimable
const old = await prisma.deployRequest.create({
  data: { targetSha: SHA, createdById: 'owner-admin-1', status: 'REQUESTED', createdAt: new Date(Date.now() - 60 * 60000) },
});
const claimAfterExpire = await adminService.claimNextDeployRequest();
const expiredRow = await prisma.deployRequest.findUnique({ where: { id: old.id } });
ok(expiredRow.status === 'EXPIRED' && claimAfterExpire === null, 'stale request expires and is never claimed');

// [6] forced audit while ordinary logging is paused
await prisma.featureFlag.upsert({ where: { key: 'audit_logging' }, create: { key: 'audit_logging', description: 'f', isEnabled: false, enabledForPlans: 'FREE,PRO,ENTERPRISE' }, update: { isEnabled: false } });
await adminService.createDeployRequest('owner-admin-1', SHA, 'DEPLOY');
ok((await prisma.auditLog.count({ where: { action: 'ADMIN_DEPLOY_REQUEST' } })) >= 1, 'deploy request audit persists while audit logging is paused');
await realAudit.log({ action: 'SHOULD_BE_SKIPPED_P7' });
ok((await prisma.auditLog.count({ where: { action: 'SHOULD_BE_SKIPPED_P7' } })) === 0, 'ordinary audit stays suppressed while paused');
// cleanup: cancel the active request + re-enable flag
const act = await prisma.deployRequest.findFirst({ where: { status: 'REQUESTED' } });
await adminService.cancelDeployRequest('owner-admin-1', act.id);
await prisma.featureFlag.update({ where: { key: 'audit_logging' }, data: { isEnabled: true } });

// [7] HTTP route matrix over real controllers
// Concurrency: two truly simultaneous creates; exactly one may win.
{
  const results = await Promise.allSettled([
    adminService.createDeployRequest('owner-admin-1', SHA, 'DEPLOY'),
    adminService.createDeployRequest('owner-admin-1', SHA2, 'DEPLOY'),
  ]);
  const wins = results.filter((x) => x.status === 'fulfilled');
  const losses = results.filter((x) => x.status === 'rejected' && /already active/.test(x.reason?.message || ''));
  ok(wins.length === 1 && losses.length === 1, 'concurrent create: exactly one wins single-active');
  const act2 = await prisma.deployRequest.findFirst({ where: { status: 'REQUESTED' } });
  await adminService.cancelDeployRequest('owner-admin-1', act2.id);
}
// Concurrency: two truly simultaneous claims; exactly one may win.
{
  await adminService.createDeployRequest('owner-admin-1', SHA, 'DEPLOY');
  const results = await Promise.allSettled([
    adminService.claimNextDeployRequest(),
    adminService.claimNextDeployRequest(),
  ]);
  const wins = results.filter((x) => x.status === 'fulfilled' && x.value);
  ok(wins.length === 1, 'concurrent claim: exactly one claim wins');
  const cl = wins[0].value;
  await adminService.reportDeployRequest(cl.id, cl.runId, { action: 'FAIL', failureReason: 'cleanup' });
}
// Redaction beyond dmp_live_ keys: DB URLs with passwords, bearer headers, provider tokens.
{
  await adminService.createDeployRequest('owner-admin-1', SHA, 'DEPLOY');
  const cl = await adminService.claimNextDeployRequest();
  await adminService.reportDeployRequest(cl.id, cl.runId, { action: 'START' });
  const rep = await adminService.reportDeployRequest(cl.id, cl.runId, {
    action: 'FAIL',
    failureReason: 'connect postgres://app:s3cretpw123@db.internal:5432/dmpilot failed',
    logTail: 'hdr authorization: Bearer abc.def.ghi-jkl tok ' + ('sk_live_' + '4eC39HqLyjWDarjtT1zdp7dc') + ' url postgres://u:hunter2@h/db dmp_live_LEAKME123',
  });
  const stored = `${rep.failureReason} ${rep.logTail}`;
  ok(
    !stored.includes('s3cretpw123') &&
      !stored.includes('hunter2') &&
      !stored.includes('abc.def.ghi') &&
      !stored.includes('4eC39HqLyjWDarjtT1zdp7dc') &&
      !stored.includes('LEAKME123') &&
      !stored.includes('postgres://'),
    'report redacts DB URLs, bearer tokens, provider tokens and api keys',
  );
}

const { NestFactory } = await import('@nestjs/core');
const { Module } = await import('@nestjs/common');
const { PassportModule } = await import('@nestjs/passport');
const { JwtModule, JwtService } = await import('@nestjs/jwt');
const { AdminController } = await import('../dist/admin/admin.controller.js');
const { DeployWatcherController } = await import('../dist/admin/deploy-watcher.controller.js');
const { JwtStrategy } = await import('../dist/auth/strategies/jwt.strategy.js');
const { ConfigService } = await import('../dist/config/config.service.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { FeatureFlagService } = await import('../dist/billing/feature-flag.service.js');
const { MonitoringService } = await import('../dist/monitoring/monitoring.service.js');
const { EmailAutomationsService } = await import('../dist/admin/email-automations.service.js');
const { ServiceAccessService } = await import('../dist/billing/service-access.service.js');
const { CouponService } = await import('../dist/billing/coupon.service.js');
const { TesterAccessService } = await import('../dist/instagram/tester-access.service.js');

const crypto = await import('node:crypto');
const apiKeyService = new ApiKeyService(prisma, realAudit);
const deployKeyRaw = 'dmp_live_' + crypto.randomBytes(24).toString('hex');
await prisma.apiKey.create({ data: { userId: 'owner-admin-1', name: 'w', allowAllAccounts: true, keyHash: crypto.createHash('sha256').update(deployKeyRaw).digest('hex'), prefix: 'x', scopes: ['deploy'], expiresAt: new Date(Date.now() + 86400000) } });
const readKeyRaw = 'dmp_live_' + crypto.randomBytes(24).toString('hex');
await prisma.apiKey.create({ data: { userId: 'owner-admin-1', name: 'r', allowAllAccounts: true, keyHash: crypto.createHash('sha256').update(readKeyRaw).digest('hex'), prefix: 'x', scopes: ['read'], expiresAt: new Date(Date.now() + 86400000) } });

const { RequiresScopes: RequiresScopesDec } = await import('../dist/auth/decorators/requires-scopes.decorator.js');
const { JwtAuthGuard } = await import('../dist/auth/guards/jwt-auth.guard.js');
const common = await import('@nestjs/common');
// Stub ordinary routes to prove the deploy key is confined to watcher routes:
// one key-accessible route (read-scoped, like connector reads) and one plain
// session route with no key metadata (fail-closed for any key).
class StubScopedConnectorController {
  list() { return { ok: true }; }
}
common.Get('list')(StubScopedConnectorController.prototype, 'list', Object.getOwnPropertyDescriptor(StubScopedConnectorController.prototype, 'list'));
RequiresScopesDec('read')(StubScopedConnectorController.prototype, 'list', Object.getOwnPropertyDescriptor(StubScopedConnectorController.prototype, 'list'));
common.Controller('stub-connectors')(StubScopedConnectorController);
common.UseGuards(JwtAuthGuard)(StubScopedConnectorController);
class StubPlainController {
  list() { return { ok: true }; }
}
common.Get('list')(StubPlainController.prototype, 'list', Object.getOwnPropertyDescriptor(StubPlainController.prototype, 'list'));
common.Controller('stub-plain')(StubPlainController);
common.UseGuards(JwtAuthGuard)(StubPlainController);

class HttpModule {}
Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: 'it-secret', signOptions: { expiresIn: '1h' } }),
  ],
  controllers: [AdminController, DeployWatcherController, StubScopedConnectorController, StubPlainController],
  providers: [
    AdminService,
    JwtStrategy,
    { provide: PrismaService, useValue: prisma },
    { provide: ConfigService, useValue: { get: (k) => (k === 'JWT_SECRET' ? 'it-secret' : undefined) } },
    { provide: FeatureFlagService, useValue: ff },
    { provide: MonitoringService, useValue: {} },
    { provide: AuditLogService, useValue: realAudit },
    { provide: ApiKeyService, useValue: apiKeyService },
    { provide: EmailAutomationsService, useValue: {} },
    { provide: ServiceAccessService, useValue: {} },
    { provide: CouponService, useValue: {} },
    { provide: TesterAccessService, useValue: {} },
  ],
})(HttpModule);

const app = await NestFactory.create(HttpModule, { logger: false });
await app.listen(0, '127.0.0.1');
const port = app.getHttpServer().address().port;
const base = `http://127.0.0.1:${port}`;
const jwtService = app.get(JwtService);
const ownerUser = await prisma.user.findUnique({ where: { id: 'owner-admin-1' } });
const mkTok = (u) => jwtService.sign({ sub: u.id, email: u.email, role: u.role });

let r = await fetch(`${base}/watcher/deploy/claim`, { method: 'POST', headers: { authorization: `Bearer ${mkTok(ownerUser)}` } });
ok(r.status === 403, 'admin JWT cannot claim (watcher is key-only)');
r = await fetch(`${base}/watcher/deploy/claim`, { method: 'POST', headers: { 'x-api-key': readKeyRaw } });
ok(r.status === 403 || r.status === 401, `key without deploy scope cannot claim (${r.status})`);
r = await fetch(`${base}/admin/deploy-requests`, { headers: { 'x-api-key': deployKeyRaw } });
ok(r.status === 401 || r.status === 403, `deploy key cannot reach admin routes (${r.status})`);
r = await fetch(`${base}/stub-connectors/list`, { headers: { 'x-api-key': deployKeyRaw } });
ok(r.status === 403, `deploy key cannot reach read-scoped connector route (${r.status})`);
r = await fetch(`${base}/stub-plain/list`, { headers: { 'x-api-key': deployKeyRaw } });
ok(r.status === 401 || r.status === 403, `deploy key cannot reach non-key route (${r.status})`);
r = await fetch(`${base}/stub-connectors/list`, { headers: { 'x-api-key': readKeyRaw } });
ok(r.status === 200, `control: read key reaches read-scoped route (${r.status})`);
r = await fetch(`${base}/stub-plain/list`, { headers: { 'x-api-key': readKeyRaw } });
ok(r.status === 403, `control: read key also denied on non-key route (${r.status})`);
r = await fetch(`${base}/admin/deploy-requests`, { headers: { authorization: `Bearer ${mkTok(otherAdmin)}` } });
ok(r.status === 200, 'other admin can view deploy status (read-only)');
const created = await (await fetch(`${base}/admin/deploy-requests`, {
  method: 'POST', headers: { authorization: `Bearer ${mkTok(ownerUser)}`, 'content-type': 'application/json' },
  body: JSON.stringify({ targetSha: SHA2, confirm: 'DEPLOY' }),
})).json();
r = await fetch(`${base}/watcher/deploy/claim`, { method: 'POST', headers: { 'x-api-key': deployKeyRaw } });
ok(r.status === 200, 'deploy-scoped key claims the next request');
const claimBody = await r.json();
r = await fetch(`${base}/watcher/deploy/${created.id}/report`, {
  method: 'POST', headers: { 'x-api-key': deployKeyRaw, 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'START', runId: claimBody.runId, logTail: 'ok dmp_live_SECRETLEAK' }),
});
const repBody = await r.json();
ok(r.status === 200 && repBody.status === 'RUNNING' && !String(repBody.logTail).includes('SECRETLEAK'), 'report accepts transition and redacts secrets from log tail');
await app.close();

console.log(`it-phase7: all ${pass} tests passed`);
