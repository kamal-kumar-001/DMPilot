const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AnalyticsService } = require('../dist/analytics/analytics.service');

function makePrisma(seen) {
  const record = (label) => async (args) => {
    seen.push({ label, ids: args?.where?.instagramAccountId?.in ?? null });
    return 0;
  };
  return {
    instagramAccount: {
      findMany: async () => [{ id: 'own-a' }, { id: 'own-b' }],
    },
    comment: { count: record('comment') },
    message: { count: record('message') },
    campaign: { count: record('campaign') },
  };
}

test('summary accountId narrows aggregation to the caller-own account', async () => {
  const seen = [];
  const svc = new AnalyticsService(makePrisma(seen));
  await svc.getSummary('user-fixture', undefined, 'own-a');
  assert.ok(seen.length > 0);
  for (const entry of seen) {
    assert.deepEqual(entry.ids, ['own-a']);
  }
});

test('summary accountId the caller does not own fails closed to zero rows', async () => {
  const seen = [];
  const svc = new AnalyticsService(makePrisma(seen));
  const result = await svc.getSummary('user-fixture', undefined, 'not-mine');
  for (const entry of seen) {
    assert.deepEqual(entry.ids, []);
  }
  assert.equal(result.totalComments, 0);
  assert.equal(result.totalDmsSent, 0);
  assert.equal(result.failedDms, 0);
  assert.equal(result.activeCampaigns, 0);
});

test('daily-usage accountId narrows and a foreign id fails closed', async () => {
  const seen = [];
  const svc = new AnalyticsService(makePrisma(seen));
  await svc.getDailyUsage('user-fixture', 2, 'own-b');
  assert.ok(seen.length > 0);
  for (const entry of seen) {
    assert.deepEqual(entry.ids, ['own-b']);
  }

  const seenForeign = [];
  const svcForeign = new AnalyticsService(makePrisma(seenForeign));
  const rows = await svcForeign.getDailyUsage('user-fixture', 2, 'not-mine');
  for (const entry of seenForeign) {
    assert.deepEqual(entry.ids, []);
  }
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.comments === 0 && r.dmsSent === 0 && r.failedDms === 0));
});

test('no accountId keeps the existing all-accounts behavior', async () => {
  const seen = [];
  const svc = new AnalyticsService(makePrisma(seen));
  await svc.getSummary('user-fixture');
  for (const entry of seen) {
    assert.deepEqual(entry.ids, ['own-a', 'own-b']);
  }
});
