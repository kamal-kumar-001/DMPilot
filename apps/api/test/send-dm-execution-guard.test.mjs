// Execution-time send-guard tests for send-dm.processor.ts (phase 3 connector security):
// 1. Developer mock-recipient override removed - recipient is never rewritten.
// 2. Campaign lifecycle re-checked at execution: PAUSED / ARCHIVED / soft-deleted
//    campaigns fail closed and never reach the send path.
// Run after a fresh API build: pnpm --filter @dmpilot/api build && node test/send-dm-execution-guard.test.mjs
import './helpers/deny-egress.mjs'; // fail-closed: no test may reach a real provider
import assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';
import { SendDmProcessor } from '../dist/instagram/send-dm.processor.js';

let passed = 0;
function ok(name) { passed++; console.log(`  ${passed}. ${name}`); }

// Capture Nest logger output across instances.
const logs = [];
const origLog = Logger.prototype.log;
const origWarn = Logger.prototype.warn;
Logger.prototype.log = function (msg) { logs.push(String(msg)); };
Logger.prototype.warn = function (msg) { logs.push(String(msg)); };

function makeProcessor(prismaOverrides = {}) {
  const prisma = {
    instagramAccount: {
      async findUnique() {
        return { id: 'acc-1', userId: 'u1', isConnected: true, accessToken: 'enc', deletedAt: null };
      },
    },
    campaign: {
      async findUnique() {
        return {
          id: 'camp-1', userId: 'u1', instagramAccountId: 'acc-1',
          status: 'ACTIVE', deletedAt: null, type: 'COMMENT_TO_DM',
          commentReplyEnabled: false, followCheckEnabled: false,
        };
      },
    },
    ...prismaOverrides,
  };
  const encryption = { decrypt: () => 'mock_token' };
  const subscription = { getOrCreate: async () => ({ plan: 'FREE' }) };
  const featureFlags = { assertEnabled: async () => {} };
  const notifications = { create: async () => {} };
  return new SendDmProcessor(prisma, encryption, subscription, featureFlags, notifications);
}

const baseJob = {
  id: 'j1',
  data: {
    campaignId: 'camp-1',
    instagramAccountId: 'acc-1',
    recipientId: '232323232',
    recipientUsername: 'some_user',
    replyMessage: 'hi',
  },
};

// 1. Recipient is never rewritten (developer override removed).
{
  logs.length = 0;
  const p = makeProcessor();
  try { await p.process(baseJob); } catch { /* later send stages may need more mocks */ }
  const sendLine = logs.find((l) => l.includes('Sending DM to'));
  assert.ok(sendLine, 'expected the send-attempt log line');
  assert.ok(sendLine.includes('(232323232)'), 'recipient must stay the triggering recipient');
  assert.ok(!logs.some((l) => l.includes('17841458228090598')), 'no hardcoded rewrite target');
  assert.ok(!logs.some((l) => l.includes('Developer Override')), 'override log path gone');
  ok('recipient id is never rewritten to a hardcoded test id');
}

// 2. PAUSED campaign fails closed at execution.
{
  logs.length = 0;
  const p = makeProcessor({
    campaign: {
      async findUnique() {
        return {
          id: 'camp-1', userId: 'u1', instagramAccountId: 'acc-1',
          status: 'PAUSED', deletedAt: null, type: 'COMMENT_TO_DM',
          commentReplyEnabled: false, followCheckEnabled: false,
        };
      },
    },
  });
  await p.process(baseJob);
  assert.ok(logs.some((l) => l.includes('PAUSED') && l.includes('not sending')), 'paused must not send');
  assert.ok(!logs.some((l) => l.includes('Access token decrypted')), 'must stop before token use');
  ok('PAUSED campaign job aborts before token decryption/send');
}

// 3. ARCHIVED campaign fails closed.
{
  logs.length = 0;
  const p = makeProcessor({
    campaign: {
      async findUnique() {
        return {
          id: 'camp-1', userId: 'u1', instagramAccountId: 'acc-1',
          status: 'ARCHIVED', deletedAt: null, type: 'COMMENT_TO_DM',
          commentReplyEnabled: false, followCheckEnabled: false,
        };
      },
    },
  });
  await p.process(baseJob);
  assert.ok(logs.some((l) => l.includes('ARCHIVED') && l.includes('not sending')));
  assert.ok(!logs.some((l) => l.includes('Access token decrypted')));
  ok('ARCHIVED campaign job aborts before token decryption/send');
}

// 4. Soft-deleted campaign fails closed even if status stayed ACTIVE.
{
  logs.length = 0;
  const p = makeProcessor({
    campaign: {
      async findUnique() {
        return {
          id: 'camp-1', userId: 'u1', instagramAccountId: 'acc-1',
          status: 'ACTIVE', deletedAt: new Date('2026-11-01T00:00:00Z'), type: 'COMMENT_TO_DM',
          commentReplyEnabled: false, followCheckEnabled: false,
        };
      },
    },
  });
  await p.process(baseJob);
  assert.ok(logs.some((l) => l.includes('deleted') && l.includes('not sending')));
  assert.ok(!logs.some((l) => l.includes('Access token decrypted')));
  ok('soft-deleted campaign job aborts before token decryption/send');
}

// 5. ACTIVE non-deleted campaign passes the guard (reaches the send path).
{
  logs.length = 0;
  const p = makeProcessor();
  try { await p.process(baseJob); } catch { /* later stages may need more mocks */ }
  assert.ok(!logs.some((l) => l.includes('not sending')), 'active campaign must not be blocked');
  assert.ok(logs.some((l) => l.includes('Access token decrypted')), 'active campaign reaches send path');
  ok('ACTIVE campaign passes the execution-time guard');
}

Logger.prototype.log = origLog;
Logger.prototype.warn = origWarn;
console.log(`RESULT ${passed} pass 0 fail`);
