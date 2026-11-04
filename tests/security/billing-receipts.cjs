const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { SubscriptionService } = require('../../apps/api/dist/billing/subscription.service');
test('receipt endpoint owner-scoped and pending/failed rejected', async () => {
  let status = 'PENDING',
    query;
  const s = new SubscriptionService(
    {
      invoice: {
        findFirst: async (q) => {
          query = q;
          return status === null ? null : { id: 'i', status };
        },
      },
    },
    {},
    {},
    {},
  );
  for (status of ['PENDING', 'FAILED', 'CANCELLED'])
    await assert.rejects(s.getInvoiceReceipt('u', 'i'), (e) => e.getStatus() === 400);
  status = 'PAID';
  assert.equal((await s.getInvoiceReceipt('u', 'i')).status, 'PAID');
  assert.deepEqual(query.where, { id: 'i', userId: 'u' });
  status = null;
  await assert.rejects(s.getInvoiceReceipt('other', 'i'), (e) => e.getStatus() === 404);
});
test('resource usage counts current owned rows,not stale monthly counters', async () => {
  const queries = [];
  const s = new SubscriptionService(
    {
      usageRecord: {
        findMany: async () => [
          { metric: 'max_accounts', value: 0 },
          { metric: 'max_dms_per_month', value: 7 },
        ],
      },
      instagramAccount: {
        count: async (q) => {
          queries.push(q);
          return 1;
        },
      },
      campaign: { count: async () => 3 },
      keyword: { count: async () => 4 },
    },
    {},
    {},
    {},
  );
  s.getLimits = async () => ({
    subscription: { plan: 'FREE', status: 'ACTIVE' },
    limits: { max_accounts: 1, max_campaigns: 10, max_keywords: 10, max_dms_per_month: 100 },
  });
  const r = await s.getUsageSummary('u');
  assert.equal(r.usage.find((x) => x.metric === 'max_accounts').used, 1);
  assert.equal(r.usage.find((x) => x.metric === 'max_dms_per_month').used, 7);
  assert.deepEqual(queries[0].where, { userId: 'u', isConnected: true, deletedAt: null });
});
test('FeeFree session omits optional redirect when no registered return/state exists', async () => {
  let sent;
  const prisma = {
    invoice: { create: async () => ({ id: '12345678-1234-1234-1234-123456789012' }) },
    paymentSession: { create: async () => ({}) },
  };
  const service = new SubscriptionService(
    prisma,
    {},
    {
      createSession: async (input) => {
        sent = input;
        return {
          id: 'synthetic-session',
          checkoutUrl: 'https://checkout.example.invalid/session',
          expectedAmountPaise: 354,
        };
      },
    },
    {},
    { enabled: () => true, enroll: async (id) => assert.equal(id, 'synthetic-session') },
  );
  const result = await service.createFeeFreeCheckout(
    'synthetic-user',
    { name: 'Synthetic' },
    'PRO',
    'MONTHLY',
    3,
    354,
    undefined,
    'https://www.dmpilot.org',
  );
  assert.equal(Object.hasOwn(sent, 'returnUrl'), false);
  assert.equal(Object.hasOwn(sent, 'returnState'), false);
  assert.equal(sent.amountPaise, 354);
  assert.equal(result.checkoutRef, '12345678-1234-1234-1234-123456789012');
});
