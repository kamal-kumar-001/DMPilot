// Campaign account-isolation and honest-metrics regression tests.
// Run: pnpm build && node test/campaign-account-isolation.test.mjs
//
// Covers:
//  1. findAll always scopes by the caller's userId, so a per-account filter
//     naming somebody else's account simply matches nothing (fail-closed).
//  2. Restricted API keys only ever see campaigns on their allowed accounts.
//  3. findOne on another user's campaign is NotFound, never a leak.
//  4. create/update with another user's instagramAccountId is rejected by
//     the ownership check (a campaign must never fire with a stolen token).
//  5. Campaign metrics are evidence-based: "accepted" excludes manual_
//     (queued) and mock_msg_ (sandbox) message ids, and the acceptance rate
//     is null - never a fabricated 100 - before any send resolves.
import './helpers/deny-egress.mjs';
import assert from 'node:assert/strict';

const { CampaignService } = await import('../dist/campaign/campaign.service.js');

const OWNER = 'user-owner';
const OTHER = 'user-other';

function mkService({ campaign = null, account = null, counts = {} } = {}) {
  const calls = { campaignFindMany: [], campaignFindFirst: [], accountFindFirst: [], messageCount: [] };
  const prisma = {
    campaign: {
      findMany: async (args) => {
        calls.campaignFindMany.push(args);
        return [];
      },
      findFirst: async (args) => {
        calls.campaignFindFirst.push(args);
        return campaign;
      },
    },
    instagramAccount: {
      findFirst: async (args) => {
        calls.accountFindFirst.push(args);
        return account;
      },
    },
    message: {
      count: async (args) => {
        calls.messageCount.push(args);
        const w = args.where;
        if (w.status === 'FAILED') return counts.failed ?? 0;
        if (w.messageId?.startsWith === 'manual_') return counts.queued ?? 0;
        return counts.accepted ?? 0;
      },
    },
  };
  const svc = new CampaignService(
    prisma,
    { log: async () => {} },
    { setContext: () => {}, log: () => {}, warn: () => {}, error: () => {} },
    { incrementUsage: async () => {} },
    { isEnabled: async () => true },
  );
  return { svc, calls };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('ok -', name);
}

await check('findAll scopes by caller userId even with a per-account filter', async () => {
  const { svc, calls } = mkService();
  await svc.findAll(OWNER, undefined, undefined, undefined, 'acct-belongs-to-other');
  const where = calls.campaignFindMany[0].where;
  assert.equal(where.userId, OWNER);
  assert.equal(where.instagramAccountId, 'acct-belongs-to-other');
  // userId + accountId together: a foreign account matches zero rows.
});

await check('findAll with a restricted API key constrains to allowed accounts', async () => {
  const { svc, calls } = mkService();
  await svc.findAll(OWNER, undefined, undefined, ['acct-1', 'acct-2'], undefined);
  const where = calls.campaignFindMany[0].where;
  assert.equal(where.userId, OWNER);
  assert.deepEqual(where.instagramAccountId, { in: ['acct-1', 'acct-2'] });
});

await check('findOne on a foreign campaign is NotFound (id + userId scoping)', async () => {
  const { svc, calls } = mkService({ campaign: null });
  await assert.rejects(() => svc.findOne(OTHER, 'camp-1'), /not found/i);
  const where = calls.campaignFindFirst[0].where;
  assert.equal(where.id, 'camp-1');
  assert.equal(where.userId, OTHER);
});

await check('create with a foreign instagramAccountId is rejected', async () => {
  const { svc, calls } = mkService({ account: null });
  await assert.rejects(
    () => svc.create(OWNER, { instagramAccountId: 'acct-of-other', name: 'x', type: 'COMMENT_TO_DM' }),
    /not found/i,
  );
  assert.equal(calls.accountFindFirst[0].where.userId, OWNER);
});

await check('update rebinding to a foreign instagramAccountId is rejected', async () => {
  const owned = { id: 'camp-1', userId: OWNER, type: 'COMMENT_TO_DM' };
  const { svc, calls } = mkService({ campaign: owned, account: null });
  await assert.rejects(
    () => svc.update(OWNER, 'camp-1', { instagramAccountId: 'acct-of-other' }),
    /not found/i,
  );
  // Ownership proof ran against the caller, not the campaign's account.
  assert.equal(calls.accountFindFirst[0].where.id, 'acct-of-other');
  assert.equal(calls.accountFindFirst[0].where.userId, OWNER);
});

await check('metrics: accepted excludes queued (manual_) and sandbox (mock_msg_) ids', async () => {
  const owned = { id: 'camp-1', userId: OWNER, _count: { comments: 0 } };
  const { svc, calls } = mkService({ campaign: owned, counts: { accepted: 3, queued: 2, failed: 1 } });
  const result = await svc.findOne(OWNER, 'camp-1');
  const acceptedQuery = calls.messageCount.find((c) => Array.isArray(c.where.status?.in));
  assert.ok(acceptedQuery, 'accepted count query issued');
  const excludes = acceptedQuery.where.AND.map((c) => c.messageId?.not?.startsWith).sort();
  assert.deepEqual(excludes, ['manual_', 'mock_msg_']);
  // Sandbox failures must not depress the acceptance rate either.
  const failedQuery = calls.messageCount.find((c) => c.where.status === 'FAILED');
  assert.equal(failedQuery.where.messageId?.not?.startsWith, 'mock_msg_');
  assert.equal(result.metrics.totalDmsAccepted, 3);
  assert.equal(result.metrics.queuedDms, 2);
  assert.equal(result.metrics.failedDms, 1);
  assert.equal(result.metrics.acceptanceRate, 75);
});

await check('metrics: acceptance rate is null, not a fake 100, before any send resolves', async () => {
  const owned = { id: 'camp-2', userId: OWNER, _count: { comments: 0 } };
  const { svc } = mkService({ campaign: owned, counts: { accepted: 0, queued: 1, failed: 0 } });
  const result = await svc.findOne(OWNER, 'camp-2');
  assert.equal(result.metrics.acceptanceRate, null);
});

console.log(`\n${passed}/7 campaign account-isolation tests passed`);
