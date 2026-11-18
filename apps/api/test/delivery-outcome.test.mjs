// Delivery-log outcome classification: the log may only claim what the
// evidence proves. No row ever reads "delivered"/"got the DM" again.
// Run after a fresh API build: pnpm --filter @dmpilot/api build && node test/delivery-outcome.test.mjs
import './helpers/deny-egress.mjs';
import assert from 'node:assert/strict';
import {
  classifyMessageOutcome,
  dispatchStatusFor,
} from '../dist/monitoring/delivery-outcome.js';

let passed = 0;
function ok(name) {
  passed++;
  console.log(`  ${passed}. ${name}`);
}

// 1. Pending manual send: placeholder id, still unresolved - never accepted.
assert.equal(classifyMessageOutcome({ messageId: 'manual_1731_abc', status: 'SENT' }), 'QUEUED');
assert.match(dispatchStatusFor('QUEUED', ''), /still sending/i);
ok('pending manual row classifies QUEUED, copy says still sending');

// 2. Failed send: explicit failure evidence wins over any id shape.
assert.equal(classifyMessageOutcome({ messageId: 'failed_1731_xy', status: 'FAILED' }), 'FAILED');
assert.equal(classifyMessageOutcome({ messageId: 'manual_1731_abc', status: 'FAILED' }), 'FAILED');
assert.match(dispatchStatusFor('FAILED', '', 'quota reached'), /send failed \(quota reached\)/);
ok('failed rows classify FAILED with the recorded reason');

// 3. Sandbox mock path: recorded without a provider call - named, not accepted.
assert.equal(classifyMessageOutcome({ messageId: 'mock_msg_1731_zz', status: 'SENT' }), 'SANDBOX');
assert.match(dispatchStatusFor('SANDBOX', ''), /sandbox/i);
assert.doesNotMatch(dispatchStatusFor('SANDBOX', ''), /accepted/i);
ok('sandbox rows classify SANDBOX and never claim acceptance');

// 4. Real provider id: the only shape allowed to claim acceptance, and even
//    then never receipt ("delivered"/"got the DM").
assert.equal(classifyMessageOutcome({ messageId: 'mid_1784149204', status: 'SENT' }), 'ACCEPTED');
const acceptedCopy = dispatchStatusFor('ACCEPTED', 'via Share to DM');
assert.match(acceptedCopy, /accepted by Instagram/i);
assert.doesNotMatch(acceptedCopy, /delivered|got the DM/i);
ok('real provider id classifies ACCEPTED without receipt claims');

// 5. Matched comment with no message row: no outcome recorded - UNKNOWN, not
//    the old default DELIVERED.
assert.equal(classifyMessageOutcome(null), 'UNKNOWN');
assert.equal(classifyMessageOutcome(undefined), 'UNKNOWN');
assert.match(dispatchStatusFor('UNKNOWN', ''), /no send outcome is recorded/i);
ok('matched comment with no receipt classifies UNKNOWN');

console.log('RESULT', passed, 'pass 0 fail');
