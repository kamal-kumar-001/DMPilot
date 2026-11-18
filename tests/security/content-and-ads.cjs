const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { ContentPublishService } = require('../../apps/api/dist/instagram/content-publish.service');
const { AdsManagementService } = require('../../apps/api/dist/instagram/ads-management.service');

test('ContentPublishService validates ownership and persists scheduled posts safely', async () => {
  let createdPost = null;
  const mockPrisma = {
    instagramAccount: {
      findFirst: async ({ where }) => {
        if (where.userId === 'user-1' && where.id === 'acc-1') {
          return { id: 'acc-1', instagramId: 'ig-123', username: 'creator', accessToken: 'encrypted_tok' };
        }
        return null;
      },
    },
    postPublish: {
      create: async ({ data }) => {
        createdPost = { id: 'post-1', ...data, createdAt: new Date() };
        return createdPost;
      },
    },
  };

  const mockEncryption = {
    decrypt: () => 'decrypted_token',
  };

  const service = new ContentPublishService(mockPrisma, mockEncryption);

  // 1. Rejects account not owned by user
  await assert.rejects(
    service.publishMedia('hacker', {
      instagramAccountId: 'acc-1',
      mediaUrl: 'https://example.com/photo.jpg',
    }),
    /not found or not connected/,
  );

  // 2. Schedules post into the future without network side-effects
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const scheduled = await service.publishMedia('user-1', {
    instagramAccountId: 'acc-1',
    mediaUrl: 'https://example.com/photo.jpg',
    caption: 'Scheduled announcement!',
    scheduledAt: futureDate,
  });

  assert.equal(scheduled.status, 'SCHEDULED');
  assert.equal(scheduled.caption, 'Scheduled announcement!');
  assert.equal(createdPost.userId, 'user-1');
});

test('AdsManagementService creates campaigns, toggles status, and aggregates stats', async () => {
  let createdCampaign = null;
  let activeCampaigns = [];

  const mockPrisma = {
    instagramAccount: {
      findFirst: async ({ where }) => {
        if (where.userId === 'user-1' && where.id === 'acc-1') {
          return { id: 'acc-1', username: 'creator' };
        }
        return null;
      },
    },
    adCampaign: {
      create: async ({ data }) => {
        createdCampaign = { id: 'camp-1', ...data, createdAt: new Date() };
        activeCampaigns.push(createdCampaign);
        return createdCampaign;
      },
      findFirst: async ({ where }) => {
        return activeCampaigns.find((c) => c.id === where.id && c.userId === where.userId) || null;
      },
      update: async ({ where, data }) => {
        const camp = activeCampaigns.find((c) => c.id === where.id);
        if (camp) Object.assign(camp, data);
        return camp;
      },
      findMany: async ({ where }) => {
        return activeCampaigns.filter((c) => c.userId === where.userId);
      },
    },
  };

  const mockEncryption = { decrypt: () => 'token' };
  const service = new AdsManagementService(mockPrisma, mockEncryption);

  // 1. Create Ad Campaign
  const campaign = await service.createBoostCampaign('user-1', {
    instagramAccountId: 'acc-1',
    name: 'Diwali VIP Boost',
    dailyBudgetPaise: 75000, // ₹750
    objective: 'OUTCOME_ENGAGEMENT',
  });

  assert.equal(campaign.name, 'Diwali VIP Boost');
  assert.equal(campaign.dailyBudgetPaise, 75000);
  assert.equal(campaign.status, 'ACTIVE');

  // 2. Pause Campaign
  const paused = await service.updateStatus('user-1', campaign.id, 'PAUSED');
  assert.equal(paused.status, 'PAUSED');

  // 3. Resume Campaign
  const resumed = await service.updateStatus('user-1', campaign.id, 'ACTIVE');
  assert.equal(resumed.status, 'ACTIVE');

  // 4. Summary Aggregation
  const summary = await service.getAdsSummary('user-1');
  assert.equal(summary.activeCampaignsCount, 1);
  assert.equal(summary.totalSpendPaise, 0);
});
