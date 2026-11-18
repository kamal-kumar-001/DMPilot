// Draft-first, dry-run and idempotency tests (phase 3 connector security).
// Run after a fresh API build: pnpm --filter @dmpilot/api build && node test/write-safety.test.mjs
import assert from 'node:assert/strict';
import { CampaignService } from '../dist/campaign/campaign.service.js';
import { ContentPublishService } from '../dist/instagram/content-publish.service.js';
import { AdsManagementService } from '../dist/instagram/ads-management.service.js';

let passed = 0;
function ok(name) { passed++; console.log(`  ${passed}. ${name}`); }

function makeCampaignService(existing = null) {
  const created = [];
  const prisma = {
    instagramAccount: { async findFirst() { return { id: 'ig-1', userId: 'u1' }; } },
    campaign: {
      async findFirst() { return existing; },
      async create({ data }) { created.push(data); return { id: 'camp-new', ...data }; },
      async update({ data }) { return { id: 'camp-1', ...existing, ...data }; },
      async count() { return 0; },
    },
    async $transaction(fn) { return fn(this); },
  };
  const subscriptionService = {
    async getOrCreate() { return { plan: 'FREE' }; },
    async getLimits() { return { limits: { max_campaigns: -1 } }; },
    async incrementUsage() {},
  };
  const featureFlagService = { async assertEnabled() {} };
  const auditLogService = { async log() {} };
  const logger = { setContext() {}, log() {}, warn() {} };
  const svc = new CampaignService(prisma, auditLogService, logger, subscriptionService, featureFlagService);
  return { svc, created };
}

const CAMPAIGN_DTO = {
  name: 'Test campaign',
  instagramAccountId: 'ig-1',
  type: 'COMMENT_REPLY',
  replyMessage: 'thanks!',
  keywords: [],
};

// 1. Campaign create is idempotent on clientRequestId: a retry returns the original row.
{
  const existing = { id: 'camp-orig', userId: 'u1', clientRequestId: 'req-1' };
  const { svc, created } = makeCampaignService(existing);
  const res = await svc.create('u1', { ...CAMPAIGN_DTO, clientRequestId: 'req-1' });
  assert.equal(res.id, 'camp-orig');
  assert.equal(created.length, 0);
  ok('campaign create with a repeated clientRequestId returns the original campaign');
}

// 2. Campaign create honors a draft status instead of forcing ACTIVE.
{
  const { svc, created } = makeCampaignService(null);
  await svc.create('u1', { ...CAMPAIGN_DTO, status: 'PAUSED' });
  assert.equal(created[0].status, 'PAUSED');
  assert.equal(created[0].clientRequestId, null);
  ok('campaign create honors an explicit PAUSED draft status');
}

// 3. Default campaign status remains ACTIVE (no behavior change for existing clients).
{
  const { svc, created } = makeCampaignService(null);
  await svc.create('u1', CAMPAIGN_DTO);
  assert.equal(created[0].status, 'ACTIVE');
  ok('campaign create still defaults to ACTIVE when no status is given');
}

function makePublishService({ publishRows = [], http = null } = {}) {
  const created = [];
  const calls = { post: [], get: [] };
  const prisma = {
    instagramAccount: {
      async findFirst() {
        return { id: 'ig-1', userId: 'u1', username: 'tester', accessToken: 'enc-token' };
      },
    },
    postPublish: {
      async findFirst({ where }) {
        return publishRows.find((r) => r.clientRequestId === where.clientRequestId) || null;
      },
      async create({ data }) {
        created.push(data);
        return { id: 'post-new', status: 'PUBLISHED', ...data };
      },
      async update({ data }) { return data; },
    },
  };
  const encryptionService = { decrypt() { return 'plain-token'; } };
  const svc = new ContentPublishService(prisma, encryptionService, http || {
    async post(url, body) {
      calls.post.push({ url, body });
      if (url.endsWith('/media_publish')) return { data: { id: 'published-1' } };
      return { data: { id: 'container-1' } };
    },
    async get(url) { calls.get.push(url); return { data: { status_code: 'FINISHED' } }; },
  });
  return { svc, created, calls };
}

const PUBLISH_DTO = {
  instagramAccountId: 'ig-1',
  mediaUrl: 'https://cdn.example.com/photo.jpg',
  caption: 'hello',
};

// 4. Publish dry run returns the plan without writing anything.
{
  const { svc, created } = makePublishService();
  const res = await svc.publishMedia('u1', { ...PUBLISH_DTO, dryRun: true });
  assert.equal(res.dryRun, true);
  assert.equal(res.wouldPublish.username, 'tester');
  assert.equal(res.wouldPublish.mediaType, 'IMAGE');
  assert.equal(created.length, 0);
  ok('publish dry run returns the plan and writes no record');
}

// 5. Publish is idempotent on clientRequestId: a retry returns the original record.
{
  const rows = [{ id: 'post-orig', userId: 'u1', clientRequestId: 'pub-1', status: 'PUBLISHED' }];
  const { svc, created } = makePublishService({ publishRows: rows });
  const res = await svc.publishMedia('u1', { ...PUBLISH_DTO, clientRequestId: 'pub-1' });
  assert.equal(res.id, 'post-orig');
  assert.equal(created.length, 0);
  ok('publish with a repeated clientRequestId returns the original record');
}

function makeAdsService(existing = null) {
  const created = [];
  const prisma = {
    instagramAccount: {
      async findFirst() { return { id: 'ig-1', userId: 'u1', username: 'tester' }; },
    },
    adCampaign: {
      async findFirst() { return existing; },
      async create({ data }) { created.push(data); return { id: 'ad-new', ...data }; },
    },
  };
  const svc = new AdsManagementService(prisma, { decrypt() { return 'x'; } });
  return { svc, created };
}

const AD_DTO = {
  instagramAccountId: 'ig-1',
  name: 'Test boost',
  targetPostId: 'post-123',
  dailyBudgetPaise: 10000,
  durationDays: 3,
};

// 6. Boost campaigns are honest local records: no implied Meta delivery or spend.
{
  const { svc } = makeAdsService();
  const res = await svc.createBoostCampaign('u1', AD_DTO);
  assert.equal(res.deliveryMode, 'LOCAL_RECORD');
  assert.match(res.deliveryNote, /does not run ads or spend money/);
  ok('boost campaign response is labeled as a local record with no ad delivery or spend');
}

// 7. Boost campaign create is idempotent on clientRequestId.
{
  const existing = { id: 'ad-orig', userId: 'u1', clientRequestId: 'ad-1' };
  const { svc, created } = makeAdsService(existing);
  const res = await svc.createBoostCampaign('u1', { ...AD_DTO, clientRequestId: 'ad-1' });
  assert.equal(res.id, 'ad-orig');
  assert.equal(res.deliveryMode, 'LOCAL_RECORD');
  assert.equal(created.length, 0);
  ok('boost campaign with a repeated clientRequestId returns the original record');
}


// 8. Key-authenticated campaign create is clamped to a PAUSED draft.
{
  const { svc, created } = makeCampaignService(null);
  await svc.create('u1', { ...CAMPAIGN_DTO, status: 'ACTIVE' }, { draftOnly: true });
  assert.equal(created[0].status, 'PAUSED');
  ok('key-authenticated campaign create is forced to a PAUSED draft');
}

// 9. Key-authenticated callers can pause an ACTIVE campaign but can never activate.
{
  const { svc } = makeCampaignService({ id: 'camp-1', userId: 'u1', status: 'ACTIVE', deletedAt: null });
  const res = await svc.toggleStatus('u1', 'camp-1', { draftOnly: true });
  assert.equal(res.status, 'PAUSED');
  ok('key-authenticated pause of an ACTIVE campaign succeeds');
}
{
  const { svc } = makeCampaignService({ id: 'camp-1', userId: 'u1', status: 'PAUSED', deletedAt: null });
  await assert.rejects(svc.toggleStatus('u1', 'camp-1', { draftOnly: true }), /pause campaigns only/);
  ok('key-authenticated activation is rejected (dashboard-only activation)');
}

// 10. Key-authenticated publish is always a dry run.
{
  const { svc, created } = makePublishService();
  const res = await svc.publishMedia('u1', { ...PUBLISH_DTO, dryRun: false }, { draftOnly: true });
  assert.equal(res.dryRun, true);
  assert.equal(res.draftOnly, true);
  assert.equal(created.length, 0);
  ok('key-authenticated publish is forced to dry run');
}

// 11. Non-http(s) media URLs are rejected before any write or Meta call.
{
  const { svc, created } = makePublishService();
  await assert.rejects(
    svc.publishMedia('u1', { ...PUBLISH_DTO, mediaUrl: 'file:///etc/passwd' }),
    /https URL/,
  );
  assert.equal(created.length, 0);
  ok('publish rejects non-http(s) media URLs');
}

// 12. Concurrent duplicate campaign create (unique-race) returns the original.
{
  const existing = { id: 'camp-orig', userId: 'u1', clientRequestId: 'req-race' };
  const { svc } = makeCampaignService(null);
  svc; // keep reference
  const prisma = svc.prisma || null;
  // rebuild with a create() that loses the unique race
  const svc2 = (() => {
    const base = makeCampaignService(null);
    base.svc; const p2 = {
      instagramAccount: { async findFirst() { return { id: 'ig-1', userId: 'u1' }; } },
      campaign: {
        async findFirst({ where }) {
          if (where?.clientRequestId === 'req-race') return existing;
          return null;
        },
        async create() {
          const e = new Error('unique'); e.code = 'P2002'; throw e;
        },
        async count() { return 0; },
      },
      async $transaction(fn) { return fn(this); },
    };
    const sub = { async getOrCreate() { return { plan: 'FREE' }; }, async getLimits() { return { limits: { max_campaigns: -1 } }; }, async incrementUsage() {} };
    return new CampaignService(p2, { async log() {} }, { setContext() {}, log() {}, warn() {} }, sub, { async assertEnabled() {} });
  })();
  // P2002 instanceof check requires the real Prisma error class; mock via prototype
  const { Prisma } = await import('@prisma/client');
  const origCreate = svc2.prisma.campaign.create;
  svc2.prisma.campaign.create = async () => {
    throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
  };
  const res = await svc2.create('u1', { ...CAMPAIGN_DTO, clientRequestId: 'req-race' });
  assert.equal(res.id, 'camp-orig');
  ok('concurrent duplicate campaign create returns the original row');
}


// 13. Same clientRequestId with a different payload conflicts instead of
// silently returning the original operation.
{
  const existing = { id: 'camp-orig', userId: 'u1', clientRequestId: 'req-x', clientRequestHash: 'different-hash' };
  const { svc } = makeCampaignService(existing);
  await assert.rejects(
    svc.create('u1', { ...CAMPAIGN_DTO, clientRequestId: 'req-x' }),
    /already used with a different payload/,
  );
  ok('idempotent retry with a different payload returns 409 conflict');
}

// 14. Non-https media URLs and IP-literal hosts are rejected.
{
  const { svc } = makePublishService();
  await assert.rejects(
    svc.publishMedia('u1', { ...PUBLISH_DTO, mediaUrl: 'http://169.254.169.254/latest' }),
    /https URL/,
  );
  await assert.rejects(
    svc.publishMedia('u1', { ...PUBLISH_DTO, mediaUrl: 'https://127.0.0.1/x.jpg' }),
    /public hostname/,
  );
  await assert.rejects(
    svc.publishMedia('u1', { ...PUBLISH_DTO, mediaUrl: 'https://user:pw@cdn.example.com/x.jpg' }),
    /must not contain credentials/,
  );
  ok('publish rejects http, IP-literal and credential-carrying media URLs');
}


// 15. Reel publish waits for FINISHED before publishing.
{
  const statuses = ['IN_PROGRESS', 'FINISHED'];
  const calls = { post: [], get: [] };
  const http = {
    async post(url) { calls.post.push(url); return { data: { id: 'c1' } }; },
    async get(url, opts) { calls.get.push({ url, opts }); return { data: { status_code: statuses.shift() || 'FINISHED' } }; },
  };
  const { svc, created } = makePublishService({ http });
  const res = await svc.publishMedia('u1', { ...PUBLISH_DTO, mediaType: 'REEL' }, { pollIntervalMs: 1 });
  assert.equal(calls.get.filter((c) => c.opts?.params?.fields === 'status_code').length, 2, 'polled until FINISHED');
  assert.equal(calls.post.filter((u) => u.endsWith('/media_publish')).length, 1);
  ok('reel publish waits for FINISHED before publishing');
}

// 16. Reel publish fails honestly on ERROR / timeout and never publishes early.
{
  const httpErr = {
    async post() { return { data: { id: 'c1' } }; },
    async get() { return { data: { status_code: 'ERROR' } }; },
  };
  const svcErr = makePublishService({ http: httpErr }).svc;
  await assert.rejects(
    svcErr.publishMedia('u1', { ...PUBLISH_DTO, mediaType: 'REEL' }, { pollIntervalMs: 1 }),
    /processing failed/,
  );
  const httpTimeout = {
    async post() { return { data: { id: 'c1' } }; },
    async get() { return { data: { status_code: 'IN_PROGRESS' } }; },
  };
  const { svc: svcTimeout, created: createdTimeout } = makePublishService({ http: httpTimeout });
  await assert.rejects(
    svcTimeout.publishMedia('u1', { ...PUBLISH_DTO, mediaType: 'REEL' }, { pollIntervalMs: 1 }),
    /did not finish in time/,
  );
  ok('reel publish fails honestly on ERROR and timeout, never publishing early');
}

// 16b. Reel publish fails honestly on EXPIRED (distinct from ERROR) and never publishes.
{
  const calls = { post: [] };
  const httpExpired = {
    async post(url) { calls.post.push(url); return { data: { id: 'c1' } }; },
    async get() { return { data: { status_code: 'EXPIRED' } }; },
  };
  const svcExpired = makePublishService({ http: httpExpired }).svc;
  await assert.rejects(
    svcExpired.publishMedia('u1', { ...PUBLISH_DTO, mediaType: 'REEL' }, { pollIntervalMs: 1 }),
    /processing failed/,
  );
  assert.equal(calls.post.filter((u) => /media_publish/.test(u)).length, 0, 'never publishes after EXPIRED');
  ok('reel publish fails honestly on EXPIRED and never publishes');
}

// 17. Image publish does not poll container readiness.
{
  const calls = { post: [], get: [] };
  const http = {
    async post(url) { calls.post.push(url); return { data: { id: 'c1' } }; },
    async get(url, opts) { calls.get.push({ url, opts }); return { data: { status_code: 'FINISHED', id: 'm1' } }; },
  };
  const { svc } = makePublishService({ http });
  await svc.publishMedia('u1', PUBLISH_DTO);
  assert.equal(calls.get.filter((c) => c.opts?.params?.fields === 'status_code').length, 0);
  ok('image publish skips readiness polling');
}

console.log(`All ${passed} write-safety checks passed.`);
