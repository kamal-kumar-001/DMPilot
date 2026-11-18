// Phase-3 real-DB integration test: account-scoped key enforcement, idempotent
// write convergence, rate-limit accounting and legacy fail-closed policies
// against an isolated scratch Postgres (never production).
// Requires TEST_DATABASE_URL pointing at a scratch database, with the schema
// already pushed and the api built:
//   pnpm --filter @dmpilot/api build
//   TEST_DATABASE_URL=postgresql://... node test/it-phase3.test.mjs
// scripts/run-integration-tests.mjs does all of this against a disposable
// embedded Postgres.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL to a scratch Postgres to run the real-DB integration test');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { ApiKeyService } = await import('../dist/auth/api-key.service.js');
const { JwtAuthGuard } = await import('../dist/auth/guards/jwt-auth.guard.js');
const { CampaignService } = await import('../dist/campaign/campaign.service.js');
const { AnalyticsService } = await import('../dist/analytics/analytics.service.js');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });

let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };
const audit = [];
const auditLog = { async log(e) { audit.push(e); return e; } };
const apiKeyService = new ApiKeyService(prisma, auditLog);

// fixtures: one user, two Instagram accounts
const user = await prisma.user.create({ data: { email: `p3-${Date.now()}@example.test`, password: 'x', name: 't', isVerified: true } });
const acc1 = await prisma.instagramAccount.create({ data: { userId: user.id, instagramId: `ig1-${Date.now()}`, username: 'one', accessToken: 'x' } });
const acc2 = await prisma.instagramAccount.create({ data: { userId: user.id, instagramId: `ig2-${Date.now()}`, username: 'two', accessToken: 'x' } });

// [1] migration compat: legacy rows with NULL clientRequestId coexist under the unique index
const campOnA2 = await prisma.campaign.create({ data: { userId: user.id, instagramAccountId: acc2.id, name: 'legacy', type: 'COMMENT_REPLY', replyMessage: 'x' } });
const campOnA1 = await prisma.campaign.create({ data: { userId: user.id, instagramAccountId: acc1.id, name: 'legacy2', type: 'COMMENT_REPLY', replyMessage: 'x' } });
ok(true, 'existing rows with NULL clientRequestId coexist under the unique index');
await prisma.campaign.create({ data: { userId: user.id, instagramAccountId: acc1.id, name: 'k1', type: 'COMMENT_REPLY', replyMessage: 'x', clientRequestId: 'dup-1', clientRequestHash: 'h1' } });
let uniqueViolated = false;
try {
  await prisma.campaign.create({ data: { userId: user.id, instagramAccountId: acc1.id, name: 'k2', type: 'COMMENT_REPLY', replyMessage: 'x', clientRequestId: 'dup-1', clientRequestHash: 'h1' } });
} catch (e) { uniqueViolated = e.code === 'P2002'; }
ok(uniqueViolated, 'duplicate (userId, clientRequestId) violates the unique index');

// [2] parallel idempotent creates converge to one row; payload mismatch conflicts
const subscriptionService = { async getOrCreate() { return { plan: 'FREE' }; }, async getLimits() { return { limits: { max_campaigns: -1 } }; }, async incrementUsage() {} };
const campaignService = new CampaignService(prisma, auditLog, { setContext() {}, log() {}, warn() {} }, subscriptionService, { async assertEnabled() {} });
const dto = { name: 'Race', instagramAccountId: acc1.id, type: 'COMMENT_REPLY', replyMessage: 'hi', clientRequestId: `race-${Date.now()}` };
const results = await Promise.allSettled([campaignService.create(user.id, dto), campaignService.create(user.id, dto), campaignService.create(user.id, dto)]);
const ids = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.id);
const rowCount = await prisma.campaign.count({ where: { userId: user.id, clientRequestId: dto.clientRequestId } });
ok(new Set(ids).size === 1 && rowCount === 1, `parallel creates converge to one row (${ids.length} fulfilled, ${rowCount} rows)`);
let conflict = false;
try { await campaignService.create(user.id, { ...dto, replyMessage: 'changed' }); } catch (e) { conflict = /different payload/.test(e.message); }
ok(conflict, 'payload mismatch on same clientRequestId conflicts');

// [3] rate limit under real parallel load: cap 3, 8 concurrent -> exactly 3 pass
const rawKey = 'dmp_live_' + crypto.randomBytes(24).toString('hex');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
await prisma.apiKey.create({ data: { userId: user.id, name: 'rl', keyHash, prefix: 'x', scopes: ['read'], instagramAccountIds: [acc1.id], allowAllAccounts: false, expiresAt: new Date(Date.now() + 86400000), rateLimitPerMin: 3 } });
const rlResults = await Promise.allSettled(Array.from({ length: 8 }, () => apiKeyService.validateApiKey(rawKey)));
const okCount = rlResults.filter((r) => r.status === 'fulfilled' && r.value).length;
const limited = rlResults.filter((r) => r.status === 'rejected' && r.reason?.status === 429).length;
ok(okCount === 3 && limited === 5, `rate limit under parallelism: ${okCount} allowed, ${limited} x 429 (cap 3)`);

// [4] guard two-account route matrix (separate key with high cap)
const rawKey2 = 'dmp_live_' + crypto.randomBytes(24).toString('hex');
const keyHash2 = crypto.createHash('sha256').update(rawKey2).digest('hex');
await prisma.apiKey.create({ data: { userId: user.id, name: 'matrix', keyHash: keyHash2, prefix: 'x', scopes: ['read'], instagramAccountIds: [acc1.id], allowAllAccounts: false, expiresAt: new Date(Date.now() + 86400000), rateLimitPerMin: 1000 } });
const reflector = { getAllAndOverride: (_k, _t) => guardScopes };
let guardScopes = ['read'];
const guard = new JwtAuthGuard(apiKeyService, reflector);
const mkCtx = (method, path, params = {}, body = {}, query = {}) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-api-key': rawKey2 }, method, path, url: path, params, body, query }) }),
  getHandler: () => ({}), getClass: () => ({}),
});
guardScopes = ['read'];
const r1 = await guard.canActivate(mkCtx('GET', '/campaigns'));
ok(r1 === true, 'restricted key allowed on GET /campaigns (scope read)');
guardScopes = ['campaigns:write'];
let denied = false;
try { await guard.canActivate(mkCtx('PATCH', `/campaigns/${campOnA2.id}`, { id: campOnA2.id })); } catch (e) { denied = /not authorized/.test(e.message); }
ok(denied, 'restricted key denied on campaign outside allowlist');
guardScopes = ['read'];
denied = false;
try { await guard.canActivate(mkCtx('GET', '/instagram/conversations')); } catch (e) { denied = /not authorized/.test(e.message); }
ok(denied, 'restricted key denied on unfilterable conversations route');

// [5] denied attempts are audited as denials; allowed mutations audited as requests
const auditBefore = audit.length;
await prisma.apiKey.update({ where: { keyHash: keyHash2 }, data: { scopes: ['campaigns:write'] } });
guardScopes = ['campaigns:write'];
denied = false;
try { await guard.canActivate(mkCtx('PATCH', `/campaigns/${campOnA2.id}`, { id: campOnA2.id })); } catch { denied = true; }
await new Promise((r) => setTimeout(r, 50));
const denialRows = audit.slice(auditBefore).filter((a) => a.action === 'api_key.denied');
ok(denied && denialRows.length === 1, `denied out-of-account attempt audited as api_key.denied (${denialRows.length} row)`);
ok(!denialRows.some((a) => /dmp_live_|replyMessage|secret/.test(a.details)), 'denial audit carries no key material or payload');
const auditAfterDenied = audit.length;
const campOnA1b = await prisma.campaign.create({ data: { userId: user.id, instagramAccountId: acc1.id, name: 'in-scope', type: 'COMMENT_REPLY', replyMessage: 'x' } });
const rAllowed = await guard.canActivate(mkCtx('PATCH', `/campaigns/${campOnA1b.id}`, { id: campOnA1b.id }));
await new Promise((r) => setTimeout(r, 50));
const requestRows = audit.slice(auditAfterDenied).filter((a) => a.action === 'api_key.request');
ok(rAllowed === true && requestRows.length === 1, `allowed in-scope mutation audited as api_key.request (${requestRows.length} row)`);

// [6] restricted-key list reads return only allowed-account rows (acc2 seeded)
const listRows = await campaignService.findAll(user.id, undefined, undefined, [acc1.id]);
ok(listRows.length > 0 && listRows.every((c) => c.instagramAccountId === acc1.id), `restricted campaign list returns only accountA rows (${listRows.length} rows)`);
ok(!listRows.some((c) => c.id === campOnA2.id), 'accountB campaign absent from restricted list');
const fullList = await campaignService.findAll(user.id, undefined, undefined, undefined);
ok(fullList.some((c) => c.id === campOnA2.id) && fullList.some((c) => c.id === campOnA1.id), 'unrestricted list sees both accounts (seed sanity)');

// [7] restricted-key analytics aggregates only allowed-account data
const analyticsService = new AnalyticsService(prisma);
await prisma.comment.create({ data: { instagramAccountId: acc1.id, mediaId: 'm1', commentId: `c1-${Date.now()}`, text: 'a', username: 'x', userId: 'igu1' } });
await prisma.comment.create({ data: { instagramAccountId: acc2.id, mediaId: 'm2', commentId: `c2-${Date.now()}`, text: 'b', username: 'y', userId: 'igu2' } });
await prisma.message.create({ data: { instagramAccountId: acc2.id, recipientId: 'r1', senderId: 's1', messageId: `mm-${Date.now()}`, direction: 'OUTGOING', status: 'SENT' } });
await prisma.campaign.update({ where: { id: campOnA1.id }, data: { status: 'ACTIVE' } });
await prisma.campaign.update({ where: { id: campOnA2.id }, data: { status: 'ACTIVE' } });
const scopedSummary = await analyticsService.getSummary(user.id, [acc1.id]);
const expectedActiveA = await prisma.campaign.count({ where: { userId: user.id, instagramAccountId: acc1.id, status: 'ACTIVE', deletedAt: null } });
ok(scopedSummary.totalComments === 1 && scopedSummary.totalDmsSent === 0 && scopedSummary.activeCampaigns === expectedActiveA,
  `restricted analytics counts only accountA (comments=${scopedSummary.totalComments}, dms=${scopedSummary.totalDmsSent}, activeCampaigns=${scopedSummary.activeCampaigns}/${expectedActiveA})`);
const fullSummary = await analyticsService.getSummary(user.id);
ok(fullSummary.totalComments === 2 && fullSummary.totalDmsSent === 1 && fullSummary.activeCampaigns === expectedActiveA + 1, 'unrestricted analytics sees both accounts (seed sanity)');

// [8] legacy fail-closed policies against real rows
await prisma.apiKey.create({ data: { userId: user.id, name: 'legacy-exp', keyHash: crypto.createHash('sha256').update('dmp_live_legacyexp').digest('hex'), prefix: 'x', scopes: ['read'], instagramAccountIds: [acc1.id], expiresAt: null, rateLimitPerMin: 60 } });
ok((await apiKeyService.validateApiKey('dmp_live_legacyexp')) === null, 'legacy key without expiry denied (reissue required)');
await prisma.apiKey.create({ data: { userId: user.id, name: 'legacy-acct', keyHash: crypto.createHash('sha256').update('dmp_live_legacyacct').digest('hex'), prefix: 'x', scopes: ['read'], instagramAccountIds: [], allowAllAccounts: false, expiresAt: new Date(Date.now() + 86400000), rateLimitPerMin: 60 } });
ok((await apiKeyService.validateApiKey('dmp_live_legacyacct')) === null, 'legacy key without explicit account mode denied (reconfiguration required)');

console.log(`PHASE3-IT all ${pass} checks passed`);
process.exit(0);
