// Manual inbox send accounting (prequeue SENT fix):
// 1. Job with existingMessageId updates that row on success - no second
//    SENT row (double count) and no phantom accepted send.
// 2. Job without existingMessageId keeps creating a fresh row (automation).
// Run after a fresh API build: pnpm --filter @dmpilot/api build && node test/manual-send-status.test.mjs
import assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';
import { SendDmProcessor } from '../dist/instagram/send-dm.processor.js';

Logger.prototype.log = () => {};
Logger.prototype.warn = () => {};
Logger.prototype.error = () => {};

function makeTxCapture() {
  const calls = { messageCreate: 0, messageUpdate: [], other: [] };
  const tx = new Proxy(
    {},
    {
      get: (_t, model) =>
        new Proxy(
          {},
          {
            get: (_m, method) => async (args) => {
              if (model === 'message' && method === 'create') calls.messageCreate++;
              else if (model === 'message' && method === 'update') calls.messageUpdate.push(args);
              else calls.other.push(`${String(model)}.${String(method)}`);
              return {};
            },
          },
        ),
    },
  );
  return { calls, tx };
}

function makeProcessor(txCapture) {
  const prisma = {
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
  const encryption = { decrypt: () => 'mock_token' }; // sandbox path: no provider call
  const subscription = {
    getOrCreate: async () => ({ plan: 'FREE' }),
    checkLimit: async () => ({ allowed: true }),
  };
  const featureFlags = { assertEnabled: async () => {} };
  const notifications = { create: async () => {} };
  return new SendDmProcessor(prisma, encryption, subscription, featureFlags, notifications);
}

// 1. Manual send with a pre-created row: update it, never create a second row.
{
  const cap = makeTxCapture();
  const p = makeProcessor(cap);
  await p.process({
    id: 'j-manual',
    data: {
      campaignId: 'manual',
      instagramAccountId: 'acc-1',
      recipientId: '999',
      recipientUsername: 'some_user',
      replyMessage: 'hello from inbox',
      existingMessageId: 'msg-pre-1',
    },
  });
  assert.equal(cap.calls.messageCreate, 0, 'must not create a second message row');
  assert.equal(cap.calls.messageUpdate.length, 1, 'must update the pre-created row');
  const update = cap.calls.messageUpdate[0];
  assert.equal(update.where.id, 'msg-pre-1');
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
  assert.equal(cap.calls.messageUpdate.length, 0);
  console.log('  2. payload without existingMessageId keeps the create path');
}

console.log('PASS manual-send-status');
