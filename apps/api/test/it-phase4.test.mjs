// Phase-4 real-DB integration test: tester allowlist gating for privileged
// (unreviewed Meta permission) flows against an isolated scratch Postgres.
// Requires TEST_DATABASE_URL (schema pushed, api built); see
// scripts/run-integration-tests.mjs.
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL to a scratch Postgres to run the phase-4 integration test');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { TesterAccessService } = await import('../dist/instagram/tester-access.service.js');
const { ContentPublishService } = await import('../dist/instagram/content-publish.service.js');
const { AdsManagementService } = await import('../dist/instagram/ads-management.service.js');
const { CampaignService } = await import('../dist/campaign/campaign.service.js');
const { InstagramController } = await import('../dist/instagram/instagram.controller.js');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });

let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };
const audit = [];
const auditLog = { async log(e) { audit.push(e); return e; } };
const config = { get: (k) => (k === 'PRIVILEGED_FLOWS_ENABLED' ? process.env.TEST_PRIVILEGED_ENABLED ?? 'true' : undefined) };
const testerAccess = new TesterAccessService(prisma, config, auditLog);

const user = await prisma.user.create({ data: { email: `p4-${Date.now()}@example.test`, password: 'x', name: 't', isVerified: true } });
const other = await prisma.user.create({ data: { email: `p4o-${Date.now()}@example.test`, password: 'x', name: 'o', isVerified: true } });
const acc1 = await prisma.instagramAccount.create({ data: { userId: user.id, instagramId: `p4ig1-${Date.now()}`, username: 'one', accessToken: 'x' } });

const http = { post: async () => ({ data: { id: 'c1' } }), get: async () => ({ data: { status_code: 'FINISHED', id: 'm1', permalink: 'p' } }) };
const encryption = { async decrypt() { return 'token'; }, async encrypt(v) { return v; } };
const publishSvc = new ContentPublishService(prisma, encryption, http, testerAccess);
const adsSvc = new AdsManagementService(prisma, encryption, testerAccess);

// [1] non-tester denied on publish, boost and unified-connect-equivalent gate
await assert.rejects(
  publishSvc.publishMedia(user.id, { instagramAccountId: acc1.id, mediaUrl: 'https://cdn.example.com/x.jpg', mediaType: 'IMAGE' }),
  /tester access/,
);
await assert.rejects(
  adsSvc.createBoostCampaign(user.id, { instagramAccountId: acc1.id, name: 'boost' }),
  /tester access/,
);
await assert.rejects(testerAccess.assertPrivilegedConnect(user.id), /tester access/);
ok(true, 'non-tester denied on publish, boost and privileged connect');
ok(audit.filter((a) => a.action === 'tester_access.denied').length === 3, 'denials audited');

// [2] ordinary (non-privileged) campaign flows unaffected by the allowlist
const subscriptionService = { async getOrCreate() { return { plan: 'FREE' }; }, async getLimits() { return { limits: { max_campaigns: -1 } }; }, async incrementUsage() {} };
const campaignService = new CampaignService(prisma, auditLog, { setContext() {}, log() {}, warn() {} }, subscriptionService, { async assertEnabled() {} });
const camp = await campaignService.create(user.id, { name: 'ordinary', instagramAccountId: acc1.id, type: 'COMMENT_REPLY', replyMessage: 'hi' });
ok(!!camp.id, 'ordinary comment automation works without tester allowlist');

// [2b] ordinary login routes are NOT tester-gated (unified core login included)
{
  const igServiceStub = { getAuthUrl: (_u, type) => `https://oauth.example.com/?type=${type}` };
  const controller = new InstagramController(igServiceStub, null, null, null, null, null, testerAccess);
  const r1 = await controller.connect({ id: other.id }, 'instagram');
  const r2 = await controller.connect({ id: other.id }, 'facebook');
  const r3 = await controller.connect({ id: other.id }, 'unified');
  ok(Boolean(r1.url && r2.url && r3.url), 'ordinary instagram/facebook/unified connect work without tester allowlist');
  await assert.rejects(controller.connect({ id: other.id }, 'unified-privileged'), /tester access/);
  ok(true, 'unified-privileged escalation denied for non-tester');
}

// [3] account-scoped tester entry allows that account only
const entry = await testerAccess.addEntry('admin1', user.id, { instagramAccountId: acc1.id });
const post = await publishSvc.publishMedia(user.id, { instagramAccountId: acc1.id, mediaUrl: 'https://cdn.example.com/x.jpg', mediaType: 'IMAGE' });
ok(!!post.id, 'tester publish succeeds on allowed account');
const scheduledPost = await publishSvc.publishMedia(user.id, {
  instagramAccountId: acc1.id,
  mediaUrl: 'https://cdn.example.com/y.jpg',
  mediaType: 'IMAGE',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
});
const acc2 = await prisma.instagramAccount.create({ data: { userId: user.id, instagramId: `p4ig2-${Date.now()}`, username: 'two', accessToken: 'x' } });
await assert.rejects(
  publishSvc.publishMedia(user.id, { instagramAccountId: acc2.id, mediaUrl: 'https://cdn.example.com/x.jpg', mediaType: 'IMAGE' }),
  /tester access/,
);
ok(true, 'tester denied on account outside their entry');

// [4] duplicate boost submit converges (idempotency against real DB)
const b1 = await adsSvc.createBoostCampaign(user.id, { instagramAccountId: acc1.id, name: 'b', clientRequestId: `p4-${Date.now()}` });
const b2 = await adsSvc.createBoostCampaign(user.id, { instagramAccountId: acc1.id, name: 'b', clientRequestId: b1.clientRequestId });
ok(b1.id === b2.id, 'duplicate boost submit returns the original record');
let conflict = false;
try { await adsSvc.createBoostCampaign(user.id, { instagramAccountId: acc1.id, name: 'changed', clientRequestId: b1.clientRequestId }); } catch (e) { conflict = /different payload/.test(e.message); }
ok(conflict, 'boost payload mismatch conflicts');

// [5] removal revokes on next action
await testerAccess.removeEntry('admin1', entry.id);

await assert.rejects(
  adsSvc.createBoostCampaign(user.id, { instagramAccountId: acc1.id, name: 'b2' }),
  /tester access/,
);
ok(true, 'removal revokes privileged access immediately');
const paused = await adsSvc.updateStatus(user.id, b1.id, 'PAUSED');
ok(paused && paused.status === 'PAUSED', 'pausing a boost stays open after revocation (safety action)');
const cancelled = await publishSvc.cancelPost(user.id, scheduledPost.id);
ok(cancelled.success === true, 'cancelling a scheduled post stays open after revocation (safety action)');

// [6] kill switch off denies even with an entry (rollback path)
const configOff = { get: (k) => (k === 'PRIVILEGED_FLOWS_ENABLED' ? 'false' : undefined) };
const testerAccessOff = new TesterAccessService(prisma, configOff, auditLog);
await testerAccess.addEntry('admin1', user.id, { ownerLevel: true });
await assert.rejects(testerAccessOff.assertPrivilegedAction(user.id, acc1.id, 'ads_boost_create'), /tester access/);
ok(true, 'kill switch off denies privileged flows without touching the allowlist');

console.log(`PHASE4-IT all ${pass} checks passed`);
process.exit(0);
