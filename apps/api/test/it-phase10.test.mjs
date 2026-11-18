// Phase-10 server-load audit: measured regression for the dashboard
// sync-on-read fan-out and the account-health N+1.
//
// What this proves:
//   [1] syncAccountStats is TTL-throttled: the first sync for an account
//       performs Meta Graph calls and a DB write; a second sync inside the
//       15-minute TTL performs ZERO provider calls; after the TTL expires it
//       syncs again. Before the fix, EVERY GET /instagram (every dashboard
//       load) ran the full provider fan-out per account.
//   [2] GET /instagram health enrichment issues zero per-account findFirst
//       queries (one distinct findMany instead) and still maps the latest
//       message per account to the correct automation status.
//
// Requires TEST_DATABASE_URL (scratch DB, schema pushed, api built).
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const { InstagramService } = await import('../dist/instagram/instagram.service.js');
const { InstagramController } = await import('../dist/instagram/instagram.controller.js');
const { EncryptionService } = await import('../dist/common/encryption/encryption.service.js');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
// Query-logging client for the health lookup: captures the actual SQL so the
// test proves bounded latest-per-account retrieval instead of assuming it.
const sqlLog = [];
const logPrisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  log: [{ emit: 'event', level: 'query' }],
});
logPrisma.$on('query', (e) => sqlLog.push(e.query));
let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };

const uniq = Date.now();
const configStub = { get: (k) => (k === 'ENCRYPTION_KEY' ? 'it-phase10-key' : undefined) };
const enc = new EncryptionService(configStub);
const loggerStub = { setContext() {}, log() {}, warn() {}, error() {} };

// Patch the CJS axios instance (dist is CJS; an ESM import would be a separate copy).
const { createRequire } = await import('node:module');
const cjsRequire = createRequire(import.meta.url);
const axios = cjsRequire('axios');

const providerCalls = [];
const origGet = axios.get, origPost = axios.post;
axios.get = async (url) => {
  providerCalls.push(['GET', url]);
  if (url.includes('graph.facebook.com') || url.includes('graph.instagram.com/v20.0/me')) {
    return { data: { followers_count: 100, follows_count: 10, media_count: 5 } };
  }
  throw new Error('unexpected GET ' + url);
};
axios.post = async (url) => {
  providerCalls.push(['POST', url]);
  if (url.includes('subscribed_apps')) return { data: { success: true } };
  throw new Error('unexpected POST ' + url);
};

try {
  const mkService = () => new InstagramService(configStub, prisma, enc, {}, loggerStub, {}, {}, {}, {});
  const svc = mkService();

  const user = await prisma.user.create({ data: { email: `p10-${uniq}@example.test`, password: 'x', name: 'P10', isVerified: true, role: 'CREATOR' } });
  const acc = await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramId: `ig-p10-${uniq}`,
      username: 'p10_acct',
      accessToken: enc.encrypt('real-looking-token-not-mock'),
      isConnected: true,
    },
  });

  // [1] Sync throttle
  providerCalls.length = 0;
  await svc.syncAccountStats(acc.id);
  const firstCallCount = providerCalls.length;
  ok(firstCallCount >= 2, `first sync reaches the provider (measured ${firstCallCount} Meta calls: metrics + webhook subscription)`);
  const afterFirst = await prisma.instagramAccount.findUnique({ where: { id: acc.id } });
  ok(afterFirst.followersCount === 100, 'first sync persists the provider metrics');

  providerCalls.length = 0;
  const followersBefore = afterFirst.followersCount;
  await svc.syncAccountStats(acc.id);
  ok(providerCalls.length === 0, `second sync inside the TTL makes ZERO provider calls (measured ${providerCalls.length}; pre-fix it made ${firstCallCount})`);
  const afterSecond = await prisma.instagramAccount.findUnique({ where: { id: acc.id } });
  ok(afterSecond.followersCount === followersBefore && afterSecond.updatedAt.getTime() === afterFirst.updatedAt.getTime(), 'throttled sync performs no DB write');

  // A different account is throttled independently (per-account TTL, not global).
  const acc2 = await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramId: `ig-p10b-${uniq}`,
      username: 'p10_acct_b',
      accessToken: enc.encrypt('real-looking-token-not-mock'),
      isConnected: true,
    },
  });
  providerCalls.length = 0;
  await svc.syncAccountStats(acc2.id);
  ok(providerCalls.length >= 2, 'throttle is per-account: a different account still syncs');

  // TTL expiry: stamp the attempt as older than the TTL and confirm a resync.
  svc.lastSyncAttempt.set(acc.id, Date.now() - 16 * 60 * 1000);
  providerCalls.length = 0;
  await svc.syncAccountStats(acc.id);
  ok(providerCalls.length >= 2, 'sync runs again after the 15-minute TTL expires');

  // A provider failure stamps the attempt too: an outage cannot turn page
  // loads into a retry storm.
  // Overlapping same-account reads collapse onto one provider fan-out: the
  // attempt is stamped synchronously before the first await.
  const accConc = await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramId: `ig-p10d-${uniq}`,
      username: 'p10_acct_d',
      accessToken: enc.encrypt('real-looking-token-not-mock'),
      isConnected: true,
    },
  });
  providerCalls.length = 0;
  await Promise.all([svc.syncAccountStats(accConc.id), svc.syncAccountStats(accConc.id), svc.syncAccountStats(accConc.id)]);
  const concCalls = providerCalls.filter(([, u]) => u.includes('graph.facebook.com')).length;
  ok(concCalls === 1, `3 overlapping same-account reads collapse to ONE provider fan-out (measured ${concCalls} metrics call)`);

  // force bypass: explicit paths can skip the TTL (the only production caller
  // is the passive dashboard read; connect fetches stats inline and the posts
  // refresh endpoint does not use syncAccountStats).
  providerCalls.length = 0;
  await svc.syncAccountStats(accConc.id, { force: true });
  ok(providerCalls.length >= 2, 'force option bypasses the TTL for explicit refresh paths');

  // Cache growth is bounded: expired entries are pruned once the map passes
  // the cap, so per-account memory cannot grow without limit.
  for (let i = 0; i < 1001; i++) svc.lastSyncAttempt.set(`stale-${i}`, Date.now() - 60 * 60 * 1000);
  const accBound = await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramId: `ig-p10e-${uniq}`,
      username: 'p10_acct_e',
      accessToken: enc.encrypt('real-looking-token-not-mock'),
      isConnected: true,
    },
  });
  providerCalls.length = 0;
  await svc.syncAccountStats(accBound.id);
  ok(providerCalls.length >= 2, 'account still syncs when the cache is at the cap');
  ok(svc.lastSyncAttempt.size <= 10, `expired entries pruned at the cap (size ${svc.lastSyncAttempt.size}, was 1001 stale + live entries)`);

  const savedGet = axios.get;
  axios.get = async () => { providerCalls.push(['GET', 'failing']); throw new Error('provider down'); };
  const acc3 = await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramId: `ig-p10c-${uniq}`,
      username: 'p10_acct_c',
      accessToken: enc.encrypt('real-looking-token-not-mock'),
      isConnected: true,
    },
  });
  providerCalls.length = 0;
  await svc.syncAccountStats(acc3.id);
  const failFirst = providerCalls.length;
  await svc.syncAccountStats(acc3.id);
  ok(failFirst > 0 && providerCalls.length === failFirst, 'failed sync attempts are also throttled (no retry storm during an outage)');
  axios.get = savedGet;

  // [2] Account-health enrichment: one bounded DISTINCT ON query, no
  // per-account findFirst.
  const callCount = { messageFindFirst: 0, messageFindMany: 0, queryRaw: 0, rawRows: -1 };

  const msgOld = new Date(Date.now() - 3600_000);
  const msgNew = new Date(Date.now() - 60_000);
  const m1 = await prisma.message.create({ data: { instagramAccountId: acc.id, recipientId: 'r1', senderId: 's1', messageId: `p10-m1-${uniq}`, direction: 'OUTGOING', status: 'FAILED', createdAt: msgOld } });
  const m2 = await prisma.message.create({ data: { instagramAccountId: acc.id, recipientId: 'r2', senderId: 's2', messageId: `p10-m2-${uniq}`, direction: 'OUTGOING', status: 'SENT', createdAt: msgNew } });
  const m3 = await prisma.message.create({ data: { instagramAccountId: acc2.id, recipientId: 'r3', senderId: 's3', messageId: `p10-m3-${uniq}`, direction: 'OUTGOING', status: 'FAILED', createdAt: msgNew } });

  const syncCalls = [];
  const syncStub = { syncAccountStats: async (id) => { syncCalls.push(id); } };
  // countingPrismaLogged wraps the query-logging client so the same read
  // proves both the query count and the SQL shape.
  const countingPrismaLogged = new Proxy(logPrisma, {
    get(target, prop) {
      if (prop === 'message') {
        return new Proxy(target.message, {
          get(mTarget, mProp) {
            if (mProp === 'findFirst') {
              return (...args) => { callCount.messageFindFirst++; return mTarget.findFirst(...args); };
            }
            if (mProp === 'findMany') {
              return (...args) => { callCount.messageFindMany++; return mTarget.findMany(...args); };
            }
            return mTarget[mProp];
          },
        });
      }
      if (prop === '$queryRaw') {
        return async (...args) => {
          callCount.queryRaw++;
          const res = await target.$queryRaw(...args);
          callCount.rawRows = Array.isArray(res) ? res.length : -1;
          return res;
        };
      }
      return target[prop];
    },
  });
  const controller = new InstagramController(syncStub, {}, {}, countingPrismaLogged, configStub, {}, {});

  sqlLog.length = 0;
  const rows = await controller.getAccounts({ id: user.id });
  ok(callCount.messageFindFirst === 0, `health enrichment issues ZERO findFirst queries (measured ${callCount.messageFindFirst}; pre-fix it issued one per account = ${rows.length})`);
  ok(callCount.messageFindMany === 0 && callCount.queryRaw === 1, `health enrichment is ONE raw query (measured findMany=${callCount.messageFindMany}, $queryRaw=${callCount.queryRaw})`);

  // SQL evidence: the lookup must be a bounded latest-per-account query
  // (DISTINCT ON), not a full message-history fetch deduped in application.
  // NOTE: Prisma's `distinct` client option emits plain SELECT with no DISTINCT
  // and no LIMIT (observed in this suite before the raw-query fix), which would
  // return every message row for the accounts.
  const healthSql = sqlLog.filter((q) => q.includes('FROM "Message"'));
  ok(healthSql.length === 1, `exactly one Message query issued (logged ${healthSql.length})`);
  ok(/DISTINCT ON \("instagramAccountId"\)/i.test(healthSql[0]), 'SQL uses DISTINCT ON: dedupe happens in Postgres');
  ok(/ORDER BY "instagramAccountId", "createdAt" DESC/i.test(healthSql[0]), 'SQL ordering keeps the newest message per account');
  ok(!/SELECT \*/.test(healthSql[0]) && healthSql[0].includes('"createdAt"') && healthSql[0].includes('"status"'), 'SQL selects only the needed columns, not the full message row');
  // Bounded rows: with 3 messages across 2 messaged accounts, the query must
  // return at most one row per account, never the full history.
  ok(callCount.rawRows === 2, `query returned ${callCount.rawRows} rows for 2 messaged accounts holding 3 messages (bounded latest-per-account, not full history)`);

  const rAcc = rows.find((r) => r.id === acc.id);
  const rAcc2 = rows.find((r) => r.id === acc2.id);
  const rAcc3 = rows.find((r) => r.id === acc3.id);
  ok(rAcc.automationStatus === 'HEALTHY', 'latest message SENT maps to HEALTHY (older FAILED message correctly ignored)');
  ok(new Date(rAcc.lastActiveAt).getTime() === new Date(m2.createdAt).getTime(), 'lastActiveAt is the newest message timestamp');
  ok(rAcc2.automationStatus === 'ATTENTION_NEEDED' && new Date(rAcc2.lastActiveAt).getTime() === new Date(m3.createdAt).getTime(), 'latest message FAILED maps to ATTENTION_NEEDED with its timestamp');
  ok(rAcc3.automationStatus === 'HEALTHY' && new Date(rAcc3.lastActiveAt).getTime() === new Date(rAcc3.updatedAt).getTime(), 'account with no messages falls back to updatedAt, HEALTHY');
  ok(syncCalls.length === rows.length, 'background sync is still triggered once per account on read (now TTL-throttled server-side)');
} finally {
  axios.get = origGet;
  axios.post = origPost;
}

console.log(`it-phase10: ${pass} PASS`);
