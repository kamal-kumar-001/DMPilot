// Manual inbox send accounting (prequeue SENT fix):
// 1. Job with existingMessageId updates that row on success - no second
//    SENT row (double count) and no phantom accepted send.
// 2. Job without existingMessageId keeps creating a fresh row (automation).
// 3. Cross-owner protection: a payload carrying another account's message id
//    must never rewrite that row; the account-scoped guard matches nothing
//    and the processor falls back to creating its own row.
// 4. Quota-blocked manual send marks the pre-created row FAILED (no phantom
//    SENT left behind, no second row).
// 5. Live-provider failure then retry: the same pre-created row goes FAILED
//    on the failed attempt and SENT with the real provider id on retry -
//    one row end to end, errorMessage cleared.
// Run after a fresh API build: pnpm --filter @dmpilot/api build && node test/manual-send-status.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Logger } from '@nestjs/common';
import { SendDmProcessor } from '../dist/instagram/send-dm.processor.js';

// The compiled dist is CJS and calls axios via its own interop reference, so
// patch the shared CJS module object (and its .default alias), not the ESM
// default import. Otherwise the test would hit the real Meta API.
const require = createRequire(import.meta.url);
const axiosCjs = require('axios');
const axiosTargets = [axiosCjs, axiosCjs.default].filter(Boolean);

Logger.prototype.log = () => {};
Logger.prototype.warn = () => {};
Logger.prototype.error = () => {};

function makeTxCapture({ updateManyCount = 1 } = {}) {
  const calls = { messageCreate: 0, messageUpdateMany: [], other: [] };
  const capture = { calls, updateManyCount, tx: null };
  const tx = new Proxy(
    {},
    {
      get: (_t, model) =>
        new Proxy(
          {},
          {
            get: (_m, method) => async (args) => {
              if (model === 'message' && method === 'create') {
                calls.messageCreate++;
                return {};
              }
              if (model === 'message' && method === 'updateMany') {
                calls.messageUpdateMany.push(args);
                return { count: capture.updateManyCount };
              }
              calls.other.push(`${String(model)}.${String(method)}`);
              return {};
            },
          },
        ),
    },
  );
  capture.tx = tx;
  return capture;
}

function makeProcessor(txCapture, { token = 'mock_token', quotaAllowed = true } = {}) {
  const prisma = {
    // The quota path writes through prisma directly (no transaction), so the
    // mock delegates to the same capture as the tx proxy.
    message: {
      async updateMany(args) {
        txCapture.calls.messageUpdateMany.push(args);
        return { count: txCapture.updateManyCount };
      },
      async create() {
        txCapture.calls.messageCreate++;
        return {};
      },
    },
    instagramAccount: {
      async findUnique() {
        return { id: 'acc-1', userId: 'u1', isConnected: true, accessToken: 'enc', deletedAt: null };
      },
    },
    campaign: {
      async findUnique() {
        return null;
      },
    },
    $transaction: async (fn) => fn(txCapture.tx),
  };
  const encryption = { decrypt: () => token };
  const subscription = {
    getOrCreate: async () => ({ plan: 'FREE' }),
    checkLimit: async () => ({ allowed: quotaAllowed, used: 10, limit: 10 }),
  };
  const featureFlags = { assertEnabled: async () => {} };
  const notifications = { create: async () => {}, notifyOnce: async () => {} };
  return new SendDmProcessor(prisma, encryption, subscription, featureFlags, notifications);
}

const manualJob = {
  id: 'j-manual',
  data: {
    campaignId: 'manual',
    instagramAccountId: 'acc-1',
    recipientId: '999',
    recipientUsername: 'some_user',
    replyMessage: 'hello from inbox',
    existingMessageId: 'msg-pre-1',
  },
};

// 1. Manual send with a pre-created row: update it, never create a second row.
{
  const cap = makeTxCapture();
  const p = makeProcessor(cap);
  await p.process(manualJob);
  assert.equal(cap.calls.messageCreate, 0, 'must not create a second message row');
  assert.equal(cap.calls.messageUpdateMany.length, 1, 'must update the pre-created row');
  const update = cap.calls.messageUpdateMany[0];
  assert.equal(update.where.id, 'msg-pre-1');
  assert.equal(
    update.where.instagramAccountId,
    'acc-1',
    'update must be scoped to the job account',
  );
  assert.equal(update.data.status, 'SENT');
  assert.ok(update.data.messageId, 'stores the provider (or sandbox) message id');
  console.log('  1. manual send updates its pre-created row (no double count)');
}

// 2. Automation send without existingMessageId: still creates the row.
{
  const cap = makeTxCapture();
  const p = makeProcessor(cap);
  await p.process({
    id: 'j-auto',
    data: {
      campaignId: 'manual', // manual flow but legacy payload without the id
      instagramAccountId: 'acc-1',
      recipientId: '999',
      recipientUsername: 'some_user',
      replyMessage: 'hello',
    },
  });
  assert.equal(cap.calls.messageCreate, 1, 'legacy payload still creates the row');
  assert.equal(cap.calls.messageUpdateMany.length, 0);
  console.log('  2. payload without existingMessageId keeps the create path');
}

// 3. Cross-owner protection: the guard matches nothing (row belongs to
//    another account), so the processor must not rewrite it and instead
//    creates its own row for this account.
{
  const cap = makeTxCapture({ updateManyCount: 0 });
  const p = makeProcessor(cap);
  await p.process(manualJob);
  assert.equal(cap.calls.messageUpdateMany.length, 1, 'attempted the scoped update');
  assert.equal(
    cap.calls.messageUpdateMany[0].where.instagramAccountId,
    'acc-1',
    'guard filters by owner account',
  );
  assert.equal(cap.calls.messageCreate, 1, 'falls back to creating its own row');
  console.log('  3. cross-owner existingMessageId never rewrites the foreign row');
}

// 4. Quota-blocked manual send: pre-created row becomes FAILED, no phantom.
{
  const cap = makeTxCapture();
  const p = makeProcessor(cap, { quotaAllowed: false });
  await p.process(manualJob);
  assert.equal(cap.calls.messageCreate, 0, 'quota path must not create a second row');
  assert.equal(cap.calls.messageUpdateMany.length, 1);
  const update = cap.calls.messageUpdateMany[0];
  assert.equal(update.where.id, 'msg-pre-1');
  assert.equal(update.where.instagramAccountId, 'acc-1');
  assert.equal(update.data.status, 'FAILED');
  assert.match(update.data.errorMessage, /quota/i);
  console.log('  4. quota-blocked manual send marks its own row FAILED');
}

// 5. Live provider failure, then retry: one row, FAILED then SENT.
{
  const originals = axiosTargets.map((t) => ({ t, get: t.get, post: t.post }));
  const setAxios = (get, post) => {
    for (const t of axiosTargets) {
      t.get = get;
      t.post = post;
    }
  };
  try {
    setAxios(
      async () => ({ data: {} }),
      async () => {
        const err = new Error('connect ECONNREFUSED graph.facebook.com');
        delete err.response; // network error: temporary, job rethrows for retry
        throw err;
      },
    );
    const cap = makeTxCapture();
    const p = makeProcessor(cap, { token: 'live_token' });
    await assert.rejects(p.process(manualJob), /ECONNREFUSED/);
    assert.equal(cap.calls.messageCreate, 0, 'failed attempt creates no row');
    assert.equal(cap.calls.messageUpdateMany.length, 1);
    assert.equal(cap.calls.messageUpdateMany[0].data.status, 'FAILED');

    // Retry with the provider now succeeding: same row converges to SENT.
    setAxios(async () => ({ data: {} }), async () => ({ data: { message_id: 'live_mid_1' }, headers: {} }));
    await p.process(manualJob);
    assert.equal(cap.calls.messageCreate, 0, 'retry still creates no row');
    assert.equal(cap.calls.messageUpdateMany.length, 2);
    const retry = cap.calls.messageUpdateMany[1];
    assert.equal(retry.where.id, 'msg-pre-1');
    assert.equal(retry.where.instagramAccountId, 'acc-1');
    assert.equal(retry.data.status, 'SENT');
    assert.equal(retry.data.messageId, 'live_mid_1');
    assert.equal(retry.data.errorMessage, null, 'retry clears the previous error');
    console.log('  5. failed attempt then retry converges the same row to SENT');
  } finally {
    for (const { t, get, post } of originals) {
      t.get = get;
      t.post = post;
    }
  }
}

console.log('PASS manual-send-status');
