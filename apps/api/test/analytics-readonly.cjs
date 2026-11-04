const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AnalyticsService } = require('../dist/analytics/analytics.service');
test('follower GET is read-only even with sparse history', async () => {
  let writes = 0;
  const prisma = {
    instagramAccount: { findFirst: async () => ({ id: 'account-fixture', followersCount: 20 }) },
    followerHistory: {
      findMany: async () => [],
      count: async () => 0,
      upsert: async () => {
        writes++;
      },
    },
  };
  const result = await new AnalyticsService(prisma).getFollowerStats('user-fixture');
  assert.equal(writes, 0);
  assert.deepEqual(result.dailyHistory, []);
  assert.equal(result.currentFollowers, 20);
});
