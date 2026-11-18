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

// [9] Scheduler is DEFAULT OFF: no sweep registration without explicit activation
{
  let added = 0;
  const queueStub = { add: async () => { added++; } };
  const offExecutor = new ScheduledPublishExecutor(prisma, publishService, { get: () => undefined }, queueStub);
  await offExecutor.onApplicationBootstrap();
  ok(added === 0, 'sweep NOT registered when SCHEDULED_PUBLISH_ENABLED is unset (default off)');
  const onExecutor = new ScheduledPublishExecutor(prisma, publishService, { get: (k) => (k === 'SCHEDULED_PUBLISH_ENABLED' ? 'true' : undefined) }, queueStub);
  await onExecutor.onApplicationBootstrap();
  ok(added === 1, 'sweep registers only with explicit SCHEDULED_PUBLISH_ENABLED=true');
}

// [10] Execution-time ownership recheck: account transferred away fails the post
{
  const ownedPost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/owned.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000),
  } });
  // account row now belongs to someone else (transferred between scheduling and execution)
  await prisma.instagramAccount.update({ where: { id: accA.id }, data: { userId: userB.id } });
  await executor.publishDueScheduledPosts();
  const ownedAfter = await prisma.postPublish.findUnique({ where: { id: ownedPost.id } });
  ok(ownedAfter.status === 'FAILED' && /no longer owned/.test(ownedAfter.errorMessage), 'execution refuses when account ownership changed since scheduling');
  await prisma.instagramAccount.update({ where: { id: accA.id }, data: { userId: userA.id } });
}

// [11] Crash after provider submission, before persistence: never republished, marked unknown
{
  const crashPost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/crash.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000),
  } });
  // prisma proxy that dies on terminal-state writes (simulates process crash after Meta accepted the publish)
  const realPP = prisma.postPublish;
  const crashPrisma = new Proxy(prisma, {
    get(t, k) {
      if (k === 'postPublish') {
        return new Proxy(realPP, {
          get(tt, kk) {
            if (kk === 'update') {
              return (args) => {
                const st = args?.data?.status;
                if (st === 'PUBLISHED' || st === 'FAILED') return Promise.reject(new Error('simulated crash'));
                return tt.update(args);
              };
            }
            const v = tt[kk];
            return typeof v === 'function' ? v.bind(tt) : v;
          },
        });
      }
      return t[k];
    },
  });
  const crashPublish = new ContentPublishService(crashPrisma, enc, httpStub, undefined);
  const crashExecutor = new ScheduledPublishExecutor(crashPrisma, crashPublish, undefined);
  httpCalls.length = 0;
  await crashExecutor.publishDueScheduledPosts();
  const midState = await prisma.postPublish.findUnique({ where: { id: crashPost.id } });
  const publishCount1 = httpCalls.filter((c) => c.url.endsWith('/media_publish')).length;
  ok(publishCount1 === 1 && midState.status === 'PUBLISHING' && midState.containerId === 'container-1',
    'crash after provider submission leaves claimed row (no terminal write)');
  // age the abandoned claim, then sweep with the healthy executor
  // (write the timestamp as a UTC literal: bound params get localized into the
  // without-tz column while Prisma's own writes store UTC)
  const agedLit = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ');
  await prisma.$executeRaw`UPDATE "PostPublish" SET "updatedAt" = ${agedLit}::timestamp WHERE id = ${crashPost.id}`;
  await executor.publishDueScheduledPosts();
  const finalState = await prisma.postPublish.findUnique({ where: { id: crashPost.id } });
  const publishCount2 = httpCalls.filter((c) => c.url.endsWith('/media_publish')).length;
  ok(publishCount2 === 1, 'abandoned claim is never resubmitted to the provider');
  ok(finalState.status === 'FAILED' && /outcome unknown/.test(finalState.errorMessage),
    'abandoned claim ends FAILED with unknown-outcome note');
}


// [12] Worker execution gate: OFF refuses a queued sweep job even with a due row
// (repeatable jobs persist in Redis across restarts, so bootstrap gating alone
// is not enough); ON executes the same job.
{
  const { ScheduledPublishWorker } = await import('../dist/instagram/scheduled-publish.worker.js');
  const duePost = await prisma.postPublish.create({ data: {
    userId: userA.id, instagramAccountId: accA.id, mediaUrl: 'https://cdn.example.com/gated.png',
    mediaType: 'IMAGE', status: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000),
  } });
  const jobStub = { name: 'scheduled-publish-sweep' };

  const offWorker = new ScheduledPublishWorker(executor, { get: () => undefined });
  httpCalls.length = 0;
  await offWorker.process(jobStub);
  const offAfter = await prisma.postPublish.findUnique({ where: { id: duePost.id } });
  ok(offAfter.status === 'SCHEDULED', 'worker refuses execution while SCHEDULED_PUBLISH_ENABLED is off');
  ok(httpCalls.length === 0, 'refused job makes zero provider calls');

  const onWorker = new ScheduledPublishWorker(executor, { get: (k) => (k === 'SCHEDULED_PUBLISH_ENABLED' ? 'true' : undefined) });
  await onWorker.process(jobStub);
  const onAfter = await prisma.postPublish.findUnique({ where: { id: duePost.id } });
  const publishes = httpCalls.filter((c) => c.url.endsWith('/media_publish')).length;
  ok(onAfter.status === 'PUBLISHED' && publishes === 1, 'worker executes the same job once the gate is on');
}


// [13] HTTP role matrix on a lean module + baseline security headers riding it.
// Real guards (JwtAuthGuard, RolesGuard, ApiKeyService, JwtStrategy) against the
// real DB; only the routes are stubs. Covers: no-auth 401, creator JWT on a
// creator route, creator refused on an admin route, admin JWT allowed, API key
// fail-closed on role-gated routes, scoped key on a scoped route, wrong-scope
// key refused. Every response carries the baseline security headers.
{
  const { NestFactory } = await import('@nestjs/core');
  const { Module } = await import('@nestjs/common');
  const { PassportModule } = await import('@nestjs/passport');
  const { JwtModule, JwtService } = await import('@nestjs/jwt');
  const { JwtStrategy } = await import('../dist/auth/strategies/jwt.strategy.js');
  const { JwtAuthGuard } = await import('../dist/auth/guards/jwt-auth.guard.js');
  const { RolesGuard } = await import('../dist/auth/guards/roles.guard.js');
  const { Roles } = await import('../dist/auth/decorators/roles.decorator.js');
  const { RequiresScopes } = await import('../dist/auth/decorators/requires-scopes.decorator.js');
  const { ApiKeyService } = await import('../dist/auth/api-key.service.js');
  const { ConfigService } = await import('../dist/config/config.service.js');
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  const { securityHeaders } = await import('../dist/common/middleware/security-headers.js');
  const common = await import('@nestjs/common');
  const crypto = await import('node:crypto');

  const adminUser = await prisma.user.create({ data: { email: `p8-admin-${uniq}@example.test`, password: 'x', name: 'Adm', isVerified: true, role: 'ADMIN' } });
  const mkKey = async (scopes) => {
    const raw = 'dmp_live_' + crypto.randomBytes(24).toString('hex');
    await prisma.apiKey.create({ data: { userId: userA.id, name: 'k', allowAllAccounts: true, keyHash: crypto.createHash('sha256').update(raw).digest('hex'), prefix: raw.slice(0, 12), scopes, expiresAt: new Date(Date.now() + 86400000) } });
    return raw;
  };
  const readKey = await mkKey(['read']);
  const deployKey = await mkKey(['deploy']);

  const mkController = (path, extra = []) => {
    class C { list() { return { ok: true }; } }
    common.Get('list')(C.prototype, 'list', Object.getOwnPropertyDescriptor(C.prototype, 'list'));
    for (const d of extra) d(C.prototype, 'list', Object.getOwnPropertyDescriptor(C.prototype, 'list'));
    common.Controller(path)(C);
    return C;
  };
  const CreatorRoute = mkController('stub-creator');
  common.UseGuards(JwtAuthGuard)(CreatorRoute);
  const AdminRoute = mkController('stub-admin', [Roles('ADMIN')]);
  common.UseGuards(JwtAuthGuard, RolesGuard)(AdminRoute);
  const ScopedRoute = mkController('stub-scoped', [RequiresScopes('read')]);
  common.UseGuards(JwtAuthGuard)(ScopedRoute);

  class HttpModule {}
  Module({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: 'it-secret', signOptions: { expiresIn: '1h' } }),
    ],
    controllers: [CreatorRoute, AdminRoute, ScopedRoute],
    providers: [
      JwtStrategy, RolesGuard,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: (k) => (k === 'JWT_SECRET' ? 'it-secret' : undefined) } },
      { provide: ApiKeyService, useValue: new ApiKeyService(prisma, realAudit) },
    ],
  })(HttpModule);

  const app = await NestFactory.create(HttpModule, { logger: false });
  app.use(securityHeaders);
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const jwtService = app.get(JwtService);
  const mkTok = (u) => jwtService.sign({ sub: u.id, email: u.email, role: u.role });

  let r = await fetch(`${base}/stub-creator/list`);
  ok(r.status === 401, 'no-auth request refused (401)');
  ok(r.headers.get('x-content-type-options') === 'nosniff'
    && r.headers.get('x-frame-options') === 'DENY'
    && r.headers.get('referrer-policy') === 'no-referrer'
    && r.headers.get('permissions-policy') === 'camera=(), microphone=(), geolocation=()'
    && r.headers.get('strict-transport-security') === 'max-age=31536000; includeSubDomains'
    && r.headers.get('x-powered-by') === null,
    'baseline security headers present even on refused requests');

  r = await fetch(`${base}/stub-creator/list`, { headers: { authorization: `Bearer ${mkTok(userA)}` } });
  ok(r.status === 200, 'creator JWT reaches a creator route');

  r = await fetch(`${base}/stub-admin/list`, { headers: { authorization: `Bearer ${mkTok(userA)}` } });
  ok(r.status === 403, 'creator JWT refused on an admin-only route');

  r = await fetch(`${base}/stub-admin/list`, { headers: { authorization: `Bearer ${mkTok(adminUser)}` } });
  ok(r.status === 200, 'admin JWT reaches an admin-only route');

  r = await fetch(`${base}/stub-admin/list`, { headers: { 'x-api-key': readKey } });
  ok(r.status === 403, 'API key fail-closed on role-gated routes even for a valid key');

  r = await fetch(`${base}/stub-scoped/list`, { headers: { 'x-api-key': readKey } });
  ok(r.status === 200, 'read-scoped key reaches a read-scoped route');

  r = await fetch(`${base}/stub-scoped/list`, { headers: { 'x-api-key': deployKey } });
  ok(r.status === 403, 'wrong-scope key refused on a read-scoped route');

  r = await fetch(`${base}/stub-scoped/list`);
  ok(r.status === 401, 'no-auth refused on scoped route');
  ok(r.headers.get('x-content-type-options') === 'nosniff', 'security headers consistent across routes');

  await app.close();
}


// [14] Signup + free-plan write journey (local fixtures, no live account)
{
  const { AuthService } = await import('../dist/auth/auth.service.js');
  const mailStub = { sent: [], sendVerificationEmail: async (email, token) => { mailStub.sent.push(email); } };
  const authService = new AuthService(prisma, subService, {}, mailStub, realAudit);

  const reg = await authService.register({ email: `  P8-Signup-${uniq}@Example.TEST `, password: 'secret-pass', name: '  Signup User  ' });
  ok(reg.email === `p8-signup-${uniq}@example.test`, 'signup normalizes email (trim + lowercase)');
  ok(reg.name === 'Signup User', 'signup trims name');
  const stored = await prisma.user.findUnique({ where: { id: reg.id } });
  ok(stored.password !== 'secret-pass' && stored.password.startsWith('$2'), 'password stored hashed, never plaintext');
  ok(mailStub.sent.length === 1, 'verification email queued on signup');
  await throws(() => authService.register({ email: `p8-signup-${uniq}@EXAMPLE.test`, password: 'x', name: 'dupe' }),
    /already registered/i, 'duplicate signup refused even with different email casing');

  // A fresh signup lands on the auto-created FREE plan and its caps bind
  // immediately: 5 campaigns allowed under the fixture FREE plan, 6th refused.
  const sub = await subService.getOrCreate(reg.id);
  ok(sub.plan === 'FREE', 'new signup auto-lands on the FREE plan');
  const signupAcc = await prisma.instagramAccount.create({ data: { userId: reg.id, instagramId: `ig-signup-${uniq}`, username: 'signup_acct', accessToken: 'e', isConnected: true } });
  for (let i = 0; i < 5; i++) {
    await campaignService.create(reg.id, baseDto({ name: `cap-${i}`, instagramAccountId: signupAcc.id, keywords: [{ keyword: `k${i}`, matchingRule: 'EXACT' }] }));
  }
  await throws(() => campaignService.create(reg.id, baseDto({ name: 'cap-6', instagramAccountId: signupAcc.id, keywords: [{ keyword: 'k6', matchingRule: 'EXACT' }] })),
    /Plan limit reached/i, 'free plan campaign cap enforced on the 6th campaign');
}

// [15] IG-connect write journey with a stubbed provider boundary (axios patched;
// any unstubbed URL throws, so no real network is possible). Covers the direct
// Instagram login flow: happy path, encrypted token storage, reconnect at cap,
// second-account cap, multi-account gate, tampered and expired state.
{
  const { InstagramService } = await import('../dist/instagram/instagram.service.js');
  // dist is CJS and require()s axios's CJS build; the ESM import is a separate
  // module instance, so patch the CJS copy via createRequire.
  const { createRequire } = await import('node:module');
  const cjsRequire = createRequire(import.meta.url);
  const axios = cjsRequire('axios');
  const crypto2 = await import('node:crypto');

  const connectConfig = { get: (k) => ({
    JWT_SECRET: 'it-p8-secret', META_APP_ID: 'meta-app', META_APP_SECRET: 'meta-secret',
    INSTAGRAM_APP_ID: 'ig-app', INSTAGRAM_APP_SECRET: 'ig-secret',
    META_REDIRECT_URI: 'https://app.test/instagram/callback', FRONTEND_URL: 'https://app.test',
  })[k] };
  const loggerStub = { setContext() {}, log() {}, warn() {}, error() {} };
  const mkService = (ff) => new InstagramService(connectConfig, prisma, enc, realAudit, loggerStub, {}, subService, {}, ff);
  const ffPass = { async assertEnabled() {} };
  const { ForbiddenException } = await import('@nestjs/common');
  const ffDeny = { async assertEnabled(flag) { throw new ForbiddenException(`Feature ${flag} is not available on your plan`); } };

  const providerCalls = [];
  const igId = `ig-direct-${uniq}`;
  const origPost = axios.post, origGet = axios.get;
  axios.post = async (url) => {
    providerCalls.push(['POST', url]);
    if (url === 'https://api.instagram.com/oauth/access_token') return { data: { access_token: 'short-tok' } };
    if (url.includes('subscribed_apps')) return { data: { success: true } };
    throw new Error('unexpected POST ' + url);
  };
  axios.get = async (url) => {
    providerCalls.push(['GET', url]);
    if (url === 'https://graph.instagram.com/access_token') return { data: { access_token: 'LONG-LIVED-TOKEN-SECRET' } };
    if (url === 'https://graph.instagram.com/v20.0/me') return { data: { id: igId, username: 'fixture_acct', name: 'Fixture', followers_count: 42, follows_count: 7, media_count: 3 } };
    throw new Error('unexpected GET ' + url);
  };

  try {
    const svc = mkService(ffPass);
    const connectUser = await prisma.user.create({ data: { email: `p8-connect-${uniq}@example.test`, password: 'x', name: 'Conn', isVerified: true, role: 'CREATOR' } });
    const authUrl = svc.getAuthUrl(connectUser.id, 'instagram');
    const state = new URL(authUrl).searchParams.get('state');
    ok(Boolean(state), 'connect URL carries a signed state');

    // Happy path: first account connects; token is stored encrypted.
    const username = await svc.exchangeCodeForTokens('provider-code', state);
    const linked = await prisma.instagramAccount.findUnique({ where: { instagramId: igId } });
    ok(username === 'fixture_acct' && linked && linked.userId === connectUser.id && linked.isConnected, 'direct flow links the account to the OAuth-state user');
    ok(!linked.accessToken.includes('LONG-LIVED-TOKEN-SECRET'), 'provider token stored encrypted, never plaintext');

    // Tampered state (different userId, no valid signature) is refused.
    const [payload] = state.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ userId: userB.id, ts: Date.now() })).toString('base64url');
    await throws(() => svc.exchangeCodeForTokens('provider-code', `${forgedPayload}.deadbeef`),
      /Invalid state signature/i, 'tampered state refused (no cross-user link)');

    // Expired state (10-minute TTL) is refused, even with a valid signature.
    const oldPayload = Buffer.from(JSON.stringify({ userId: connectUser.id, ts: Date.now() - 11 * 60 * 1000 })).toString('base64url');
    const oldSig = crypto2.createHmac('sha256', 'it-p8-secret').update(oldPayload).digest('hex');
    await throws(() => svc.exchangeCodeForTokens('provider-code', `${oldPayload}.${oldSig}`),
      /expired/i, 'expired state refused');

    // Reconnect by the SAME user at the account cap is a token refresh, allowed.
    await prisma.billingPlan.update({ where: { key: 'FREE' }, data: { accountLimit: 1 } });
    const username2 = await svc.exchangeCodeForTokens('provider-code', new URL(svc.getAuthUrl(connectUser.id, 'instagram')).searchParams.get('state'));
    ok(username2 === 'fixture_acct', 'same-user reconnect at cap is allowed (token refresh)');

    // A SECOND distinct account at the FREE cap is refused on the direct path
    // (previously only the Facebook fallback enforced this), and the refusal
    // must NOT fall through to the Facebook exchange.
    providerCalls.length = 0;
    const otherIgId = `ig-direct2-${uniq}`;
    axios.get = async (url) => {
      providerCalls.push(['GET', url]);
      if (url === 'https://graph.instagram.com/access_token') return { data: { access_token: 'LONG2' } };
      if (url === 'https://graph.instagram.com/v20.0/me') return { data: { id: otherIgId, username: 'second_acct' } };
      throw new Error('unexpected GET ' + url);
    };
    await throws(() => svc.exchangeCodeForTokens('provider-code', new URL(svc.getAuthUrl(connectUser.id, 'instagram')).searchParams.get('state')),
      /account limit reached/i, 'second account refused at FREE cap on the direct path');
    ok(!providerCalls.some(([, u]) => u.includes('graph.facebook.com')), 'plan refusal never falls through to the Facebook exchange');
    const leaked = await prisma.instagramAccount.findUnique({ where: { instagramId: otherIgId } });
    ok(!leaked, 'refused connect writes no account row');

    // Multi-account feature gate fires for a second account even before the cap.
    const svcDeny = mkService(ffDeny);
    await throws(() => svcDeny.exchangeCodeForTokens('provider-code', new URL(svcDeny.getAuthUrl(connectUser.id, 'instagram')).searchParams.get('state')),
      /MULTI_ACCOUNT/i, 'multi-account gate enforced on the direct path');
  } finally {
    axios.post = origPost;
    axios.get = origGet;
  }
}


// [16] Facebook-Page fallback connect path: same enforcement as the direct
// path, with the provider boundary stubbed (direct exchange forced to fail
// with a provider error so the fallback engages; any unstubbed URL throws).
{
  const { InstagramService } = await import('../dist/instagram/instagram.service.js');
  const { createRequire: createRequire2 } = await import('node:module');
  const axios = createRequire2(import.meta.url)('axios');

  const fbConfig = { get: (k) => ({
    JWT_SECRET: 'it-p8-secret', META_APP_ID: 'meta-app', META_APP_SECRET: 'meta-secret',
    META_REDIRECT_URI: 'https://app.test/instagram/callback', FRONTEND_URL: 'https://app.test',
  })[k] };
  const loggerStub = { setContext() {}, log() {}, warn() {}, error() {} };
  const mkSvc = (ff) => new InstagramService(fbConfig, prisma, enc, realAudit, loggerStub, {}, subService, {}, ff);
  const ffPass = { async assertEnabled() {} };
  const { ForbiddenException: ForbiddenEx2 } = await import('@nestjs/common');
  const ffDeny = { async assertEnabled(flag) { throw new ForbiddenEx2(`Feature ${flag} is not available on your plan`); } };

  const fbUser = await prisma.user.create({ data: { email: `p8-fb-${uniq}@example.test`, password: 'x', name: 'FB', isVerified: true, role: 'CREATOR' } });
  const fbIgId = `ig-fb-${uniq}`;
  const fbIgId2 = `ig-fb2-${uniq}`;
  let pageIgMap = { 'page-1': { id: fbIgId, username: 'fb_acct', name: 'FB Acct', followers_count: 5, follows_count: 1, media_count: 2 } };

  const fbCalls = [];
  const origPost = axios.post, origGet = axios.get;
  axios.post = async (url) => {
    fbCalls.push(['POST', url]);
    if (url === 'https://api.instagram.com/oauth/access_token') {
      const e = new Error('Request failed with status code 400');
      e.response = { data: { error_message: 'provider down' } };
      throw e;
    }
    if (url.includes('subscribed_apps')) return { data: { success: true } };
    throw new Error('unexpected POST ' + url);
  };
  axios.get = async (url, opts) => {
    fbCalls.push(['GET', url]);
    if (url === 'https://graph.facebook.com/v20.0/oauth/access_token') {
      return { data: { access_token: opts?.params?.grant_type === 'fb_exchange_token' ? 'FB-LONG-SECRET' : 'fb-short' } };
    }
    if (url === 'https://graph.facebook.com/v20.0/me/accounts') {
      return { data: { data: Object.keys(pageIgMap).map((id) => ({ id, name: 'Page ' + id, access_token: 'PAGE-TOKEN-SECRET' })) } };
    }
    const m = url.match(/^https:\/\/graph\.facebook\.com\/v20\.0\/(page-\d+)$/);
    if (m && pageIgMap[m[1]]) return { data: { instagram_business_account: pageIgMap[m[1]] } };
    throw new Error('unexpected GET ' + url);
  };

  try {
    const svc = mkSvc(ffPass);
    // Happy path: fallback links the page's IG account, token encrypted.
    const state = new URL(svc.getAuthUrl(fbUser.id, 'facebook')).searchParams.get('state');
    await svc.exchangeCodeForTokens('provider-code', state);
    const linked = await prisma.instagramAccount.findUnique({ where: { instagramId: fbIgId } });
    ok(linked && linked.userId === fbUser.id && linked.instagramPageId === 'page-1' && linked.isConnected,
      'facebook fallback links the page IG account to the OAuth-state user');
    ok(!linked.accessToken.includes('PAGE-TOKEN-SECRET'), 'fallback page token stored encrypted');

    // Same-user reconnect at cap is allowed (token refresh) on the fallback path.
    await svc.exchangeCodeForTokens('provider-code', new URL(svc.getAuthUrl(fbUser.id, 'facebook')).searchParams.get('state'));
    ok((await prisma.instagramAccount.count({ where: { userId: fbUser.id, deletedAt: null } })) === 1,
      'same-user fallback reconnect at cap refreshes instead of adding');

    // A second distinct IG account at the FREE cap is refused on the fallback path.
    pageIgMap = { 'page-2': { id: fbIgId2, username: 'fb_second', name: 'Second' } };
    await throws(() => svc.exchangeCodeForTokens('provider-code', new URL(svc.getAuthUrl(fbUser.id, 'facebook')).searchParams.get('state')),
      /account limit reached/i, 'second account refused at FREE cap on the fallback path');
    ok(!(await prisma.instagramAccount.findUnique({ where: { instagramId: fbIgId2 } })), 'refused fallback connect writes no account row');

    // Multi-account gate keeps its 403 through the fallback catch-all.
    const svcDeny = mkSvc(ffDeny);
    await throws(() => svcDeny.exchangeCodeForTokens('provider-code', new URL(svcDeny.getAuthUrl(fbUser.id, 'facebook')).searchParams.get('state')),
      /MULTI_ACCOUNT/i, 'multi-account gate enforced on the fallback path with its real status');
    ok(!fbCalls.some(([, u]) => u.includes('api.instagram.com/oauth/access_token') === false && u.includes('graph.instagram.com')),
      'fallback path never calls graph.instagram.com');
  } finally {
    axios.post = origPost;
    axios.get = origGet;
  }
}


// [17] Cancel notification wording is plan-neutral (not hardcoded PRO)
{
  const cancelUser = await prisma.user.create({ data: { email: `p8-cancel-${uniq}@example.test`, password: 'x', name: 'Cancel', isVerified: true, role: 'CREATOR' } });
  await subService.getOrCreate(cancelUser.id);
  await subService.cancelSubscription(cancelUser.id, { reason: 'Too Expensive', feedback: '' });
  const notif = await prisma.notification.findFirst({ where: { userId: cancelUser.id }, orderBy: { createdAt: 'desc' } });
  ok(notif && /premium access/.test(notif.message) && !/PRO access/.test(notif.message),
    'cancel notification says plan-neutral premium access');
  const cancelledSub = await prisma.subscription.findUnique({ where: { userId: cancelUser.id } });
  ok(cancelledSub.cancelAtPeriodEnd === true, 'cancel marks cancel-at-period-end only (no immediate downgrade)');
}

console.log(`it-phase8: all ${pass} tests passed`);
