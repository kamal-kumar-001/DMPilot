// Phase-8 real-DB integration test: creator UX/security/edge-case audit fixes.
// Campaign update IDOR, partial-update preservation, duplicate/normalized
// keywords, DTO input caps, disconnect frees account slot, followers first-point
// honesty, scheduled-publish executor (claim, execute, stale, disconnected).
// Requires TEST_DATABASE_URL (scratch DB, schema pushed, api built).
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { CampaignService } = await import('../dist/campaign/campaign.service.js');
const { AnalyticsService } = await import('../dist/analytics/analytics.service.js');
const { SubscriptionService } = await import('../dist/billing/subscription.service.js');
const { ContentPublishService } = await import('../dist/instagram/content-publish.service.js');
const { ScheduledPublishExecutor } = await import('../dist/instagram/scheduled-publish.processor.js');
const { AuditLogService } = await import('../dist/auth/audit-log.service.js');
const { EncryptionService } = await import('../dist/common/encryption/encryption.service.js');
const { ValidationPipe, BadRequestException } = await import('@nestjs/common');
const { CreateCampaignDto } = await import('../dist/campaign/dto/campaign.dto.js');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };
const throws = async (fn, re, m) => {
  try { await fn(); } catch (e) {
    const hay = `${e.message} ${JSON.stringify(e.response?.message || e.response || '')}`;
    assert.ok(re.test(hay), `${m} (wrong error: ${hay.slice(0, 200)})`);
    pass++; console.log('  PASS', m); return;
  }
  assert.fail(`${m} (no error thrown)`);
};

const uniq = Date.now();
const userA = await prisma.user.create({ data: { email: `p8-a-${uniq}@example.test`, password: 'x', name: 'A', isVerified: true, role: 'CREATOR' } });
const userB = await prisma.user.create({ data: { email: `p8-b-${uniq}@example.test`, password: 'x', name: 'B', isVerified: true, role: 'CREATOR' } });
const accA = await prisma.instagramAccount.create({ data: { userId: userA.id, instagramId: `ig-a-${uniq}`, username: 'acc_a', accessToken: 'enc_a', isConnected: true } });
const accB = await prisma.instagramAccount.create({ data: { userId: userB.id, instagramId: `ig-b-${uniq}`, username: 'acc_b', accessToken: 'enc_b', isConnected: true } });

const realAudit = new AuditLogService(prisma);
const ffStub = { async assertEnabled() {} };
const notifStub = { async notifyOnce() {} };
const configStub = { get: (k) => (k === 'ENCRYPTION_KEY' ? 'it-phase8-key' : undefined) };
const subService = new SubscriptionService(prisma, configStub, {}, notifStub, {});
const campaignService = new CampaignService(prisma, realAudit, { setContext() {}, log() {}, warn() {}, error() {} }, subService, ffStub);
const analyticsService = new AnalyticsService(prisma);
const enc = new EncryptionService(configStub);
const httpCalls = [];
const httpStub = {
  post: async (url, body) => {
    httpCalls.push({ method: 'POST', url, body });
    if (url.endsWith('/media')) return { data: { id: 'container-1' } };
    if (url.endsWith('/media_publish')) return { data: { id: 'published-1' } };
    throw new Error('unexpected POST ' + url);
  },
  get: async (url) => {
    httpCalls.push({ method: 'GET', url });
    return { data: { permalink: 'https://instagram.com/p/xyz' } };
  },
};
const publishService = new ContentPublishService(prisma, enc, httpStub, undefined);
const executor = new ScheduledPublishExecutor(prisma, publishService, undefined);

const baseDto = (over = {}) => ({
  name: 'Test campaign',
  type: 'KEYWORD_TO_DM',
  instagramAccountId: accA.id,
  replyMessage: 'thanks!',
  keywords: [{ keyword: 'sale', matchingRule: 'EXACT' }],
  ...over,
});

// [1] Campaign update cannot rebind to another user's Instagram account (IDOR)
{
  const c = await campaignService.create(userA.id, baseDto());
  await throws(
    () => campaignService.update(userA.id, c.id, { instagramAccountId: accB.id }),
    /Connected Instagram account not found/,
    'update refuses rebinding campaign to another user\'s account',
  );
  const after = await prisma.campaign.findUnique({ where: { id: c.id } });
  ok(after.instagramAccountId === accA.id, 'campaign account unchanged after refused rebind');
}

// [2] Partial update preserves replyMediaUrl / commentReplyText
{
  const c = await campaignService.create(userA.id, baseDto({
    name: 'media campaign', replyMediaUrl: 'https://cdn.example.com/a.png',
    commentReplyEnabled: true, commentReplyText: 'public reply',
  }));
  await campaignService.update(userA.id, c.id, { name: 'renamed' });
  const after = await prisma.campaign.findUnique({ where: { id: c.id } });
  ok(after.replyMediaUrl === 'https://cdn.example.com/a.png', 'absent replyMediaUrl preserved on partial update');
  ok(after.commentReplyText === 'public reply', 'absent commentReplyText preserved on partial update');
  await campaignService.update(userA.id, c.id, { replyMediaUrl: '' });
  const cleared = await prisma.campaign.findUnique({ where: { id: c.id } });
  ok(cleared.replyMediaUrl === null, 'explicit empty string still clears replyMediaUrl');
}

// [3] Duplicate keywords rejected after normalization; update normalizes like create
{
  await throws(
    () => campaignService.create(userA.id, baseDto({ name: 'dup kw', keywords: [
      { keyword: 'Sale', matchingRule: 'EXACT' },
      { keyword: ' sale ', matchingRule: 'EXACT' },
    ] })),
    /Duplicate keyword/,
    'create rejects keywords that normalize to the same value',
  );
  const c = await campaignService.create(userA.id, baseDto({ name: 'norm kw' }));
  await throws(
    () => campaignService.update(userA.id, c.id, { keywords: [
      { keyword: 'promo', matchingRule: 'EXACT' },
      { keyword: 'PROMO', matchingRule: 'CONTAINS' },
    ] }),
    /Duplicate keyword/,
    'update rejects normalized duplicates',
  );
  await campaignService.update(userA.id, c.id, { keywords: [{ keyword: '  BIG Sale ', matchingRule: 'EXACT' }] });
  const kw = await prisma.keyword.findFirst({ where: { campaignId: c.id } });
  ok(kw.keyword === 'big sale', 'update path lowercases and trims keywords like create');
  await throws(
    () => campaignService.update(userA.id, c.id, { keywords: [{ keyword: '   ', matchingRule: 'EXACT' }] }),
    /cannot be empty/,
    'blank keyword rejected',
  );
}

// [4] DTO input caps enforced by the validation pipe
{
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  const run = (body) => pipe.transform(body, { type: 'body', metatype: CreateCampaignDto });
  await throws(() => run(baseDto({ keywords: [{ keyword: 'x'.repeat(101), matchingRule: 'EXACT' }] })),
    / shorter than or equal to 100 |maximum|MaxLength|keyword/i, 'keyword over 100 chars rejected');
  await throws(() => run(baseDto({ name: 'n'.repeat(201) })),
    /name/i, 'name over 200 chars rejected');
  await throws(() => run(baseDto({ replyMessage: 'r'.repeat(2001) })),
    /replyMessage/i, 'replyMessage over 2000 chars rejected');
  const valid = await run(baseDto({ name: 'valid' }));
  ok(valid.name === 'valid', 'valid payload still passes the pipe');
}

// [5] Disconnect frees the account slot for the plan cap
{
  await prisma.billingPlan.upsert({
    where: { key: 'FREE' },
    create: { key: 'FREE', name: 'Free', campaignLimit: 5, keywordLimit: 10, dmLimitMonthly: 100, accountLimit: 1 },
    update: { accountLimit: 1 },
  });
  const u = await prisma.user.create({ data: { email: `p8-cap-${uniq}@example.test`, password: 'x', name: 'C', isVerified: true, role: 'CREATOR' } });
  const a1 = await prisma.instagramAccount.create({ data: { userId: u.id, instagramId: `ig-cap1-${uniq}`, username: 'cap1', accessToken: 'e', isConnected: true } });
  let r = await subService.checkLimit(u.id, 'max_accounts');
  ok(r.allowed === false && r.used === 1, 'at cap with one connected account');
  await prisma.instagramAccount.update({ where: { id: a1.id }, data: { isConnected: false, deletedAt: new Date() } });
  r = await subService.checkLimit(u.id, 'max_accounts');
  ok(r.allowed === true && r.used === 0, 'disconnect frees the account slot');
}

// [6] Follower stats: first point change is honest zero, no-account is empty
{
  const f = await analyticsService.getFollowerStats(userA.id);
  ok(f.currentFollowers === 0 && f.dailyHistory.length === 0, 'no connected account returns zeros and empty history');
  await prisma.followerHistory.create({ data: { instagramAccountId: accA.id, date: new Date(Date.now() - 86400000), followerCount: 100 } });
  await prisma.followerHistory.create({ data: { instagramAccountId: accA.id, date: new Date(), followerCount: 130 } });
  const f2 = await analyticsService.getFollowerStats(userA.id);
  ok(f2.dailyHistory[0].change === 0, 'first history point change is 0 (no fabricated delta)');
  ok(f2.dailyHistory[1].change === 30, 'later points show real deltas');
}

// [7] Scheduled publish executor: due post published, future untouched, atomic claim
{
  const duePost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/due.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000),
  } });
  const futurePost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/future.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 3600000),
  } });
  httpCalls.length = 0;
  const r = await executor.publishDueScheduledPosts();
  const dueAfter = await prisma.postPublish.findUnique({ where: { id: duePost.id } });
  const futureAfter = await prisma.postPublish.findUnique({ where: { id: futurePost.id } });
  ok(r.claimed === 1, 'executor claims exactly the due post');
  ok(dueAfter.status === 'PUBLISHED' && dueAfter.publishedMediaId === 'published-1', 'due post published via Meta flow');
  ok(httpCalls.some((c) => c.url.endsWith('/media_publish')), 'Meta publish endpoint called');
  ok(futureAfter.status === 'SCHEDULED', 'future post untouched');
  const r2 = await executor.publishDueScheduledPosts();
  ok(r2.claimed === 0, 'second sweep does not republish');

  // atomic claim: two competing sweeps, one winner
  const racePost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/race.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000),
  } });
  httpCalls.length = 0;
  await Promise.all([executor.publishDueScheduledPosts(), executor.publishDueScheduledPosts()]);
  const raceAfter = await prisma.postPublish.findUnique({ where: { id: racePost.id } });
  const publishCalls = httpCalls.filter((c) => c.url.endsWith('/media_publish')).length;
  ok(raceAfter.status === 'PUBLISHED' && publishCalls === 1, 'concurrent sweeps publish a due post exactly once');
}

// [8] Executor edge cases: disconnected account fails honestly; stale claim never republished
{
  const orphanPost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/orphan.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000),
  } });
  await prisma.instagramAccount.update({ where: { id: accA.id }, data: { isConnected: false, deletedAt: new Date() } });
  await executor.publishDueScheduledPosts();
  const orphanAfter = await prisma.postPublish.findUnique({ where: { id: orphanPost.id } });
  ok(orphanAfter.status === 'FAILED' && /disconnected/.test(orphanAfter.errorMessage), 'post for disconnected account fails honestly');
  await prisma.instagramAccount.update({ where: { id: accA.id }, data: { isConnected: true, deletedAt: null } });

  // simulate a claim abandoned long ago (explicit UTC value; raw SQL NOW()
  // would write DB-timezone wall time into a without-tz column)
  const stalePost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/stale.png',
    mediaType: 'IMAGE', status: 'PUBLISHING', scheduledAt: new Date(Date.now() - 3600000),
    createdAt: new Date(Date.now() - 3600000), updatedAt: new Date(Date.now() - 3600000),
  } });
  httpCalls.length = 0;
  const r3 = await executor.publishDueScheduledPosts();
  const staleAfter = await prisma.postPublish.findUnique({ where: { id: stalePost.id } });
  ok(r3.stale >= 1 && staleAfter.status === 'FAILED' && /outcome unknown/.test(staleAfter.errorMessage), 'stale claim marked failed with unknown-outcome note');
  ok(httpCalls.filter((c) => c.url.endsWith('/media_publish')).length === 0, 'stale claim never republished');
}

console.log(`it-phase8: all ${pass} tests passed`);
