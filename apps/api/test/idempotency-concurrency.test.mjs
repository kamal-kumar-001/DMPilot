// Real-DB idempotency concurrency test (phase 3): parallel duplicate creates
// against an isolated Postgres must yield exactly one row via the
// (userId, clientRequestId) unique constraint, never two, never a silent
// payload-mismatch success.
// Requires TEST_DATABASE_URL pointing at a scratch database (never production):
//   TEST_DATABASE_URL=postgresql://... pnpm --filter @dmpilot/api build && node test/idempotency-concurrency.test.mjs
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL to a scratch Postgres to run the real-DB concurrency test');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { CampaignService } = await import('../dist/campaign/campaign.service.js');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });

const user = await prisma.user.create({
  data: { email: `test-${Date.now()}@example.test`, password: 'x', name: 't', isVerified: true },
});
const account = await prisma.instagramAccount.create({
  data: {
    userId: user.id, instagramId: `ig-${Date.now()}`, username: 't', displayName: 't',
    accessToken: 'x',
  },
});

const subscriptionService = {
  async getOrCreate() { return { plan: 'FREE' }; },
  async getLimits() { return { limits: { max_campaigns: -1 } }; },
  async incrementUsage() {},
};
const svc = new CampaignService(
  prisma, { async log() {} }, { setContext() {}, log() {}, warn() {} },
  subscriptionService, { async assertEnabled() {} },
);

const dto = {
  name: 'Race', instagramAccountId: account.id, type: 'COMMENT_REPLY',
  replyMessage: 'hi', clientRequestId: `race-${Date.now()}`,
};
const results = await Promise.allSettled([svc.create(user.id, dto), svc.create(user.id, dto), svc.create(user.id, dto)]);
const ids = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.id);
assert.equal(new Set(ids).size, 1, 'parallel duplicate creates must converge to one row');
const rows = await prisma.campaign.count({ where: { userId: user.id, clientRequestId: dto.clientRequestId } });
assert.equal(rows, 1);
console.log('1. parallel duplicate create converges to a single row (unique constraint holds)');

await assert.rejects(
  svc.create(user.id, { ...dto, replyMessage: 'different payload' }),
  /already used with a different payload/,
);
console.log('2. same key with different payload conflicts');
await prisma.$disconnect();
console.log('Real-DB idempotency checks passed.');
