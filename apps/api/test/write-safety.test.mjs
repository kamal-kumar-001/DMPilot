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

function makePublishService({ publishRows = [] } = {}) {
  const created = [];
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
  const svc = new ContentPublishService(prisma, encryptionService);
  return { svc, created };
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

console.log(`All ${passed} write-safety checks passed.`);
