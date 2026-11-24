// Username-resolution tests for keepcue-forward.ts (DM sender @handle via
// the connected account's stored page token, matching the DM inbox lookup).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIgUsername,
  buildBridgeBody,
  IG_USERNAME_RE,
} from '../dist/instagram/keepcue-forward.js';

test('resolveIgUsername returns null without a token and never calls fetch', async () => {
  let calls = 0;
  const out = await resolveIgUsername('17841450000000000', null, async () => {
    calls++;
    throw new Error('no call permitted');
  });
  assert.equal(out, null);
  assert.equal(calls, 0);
});

test('resolveIgUsername returns the handle on success only, matching DMPilot graph call shape', async () => {
  const okFetch = async (url) => {
    assert.match(
      url,
      /^https:\/\/graph\.facebook\.com\/v20\.0\/17841450000000000\?fields=username,name&access_token=token-abc$/,
    );
    return { ok: true, json: async () => ({ username: 'kamal.kumar' }) };
  };
  assert.equal(await resolveIgUsername('17841450000000000', 'token-abc', okFetch), 'kamal.kumar');
  const notFound = async () => ({ ok: false, json: async () => ({}) });
  assert.equal(await resolveIgUsername('17841450000000000', 'token-abc', notFound), null);
  const weird = async () => ({ ok: true, json: async () => ({ username: 'bad handle!' }) });
  assert.equal(await resolveIgUsername('17841450000000000', 'token-abc', weird), null);
  const boom = async () => { throw new Error('network down'); };
  assert.equal(await resolveIgUsername('17841450000000000', 'token-abc', boom), null);
  assert.equal(await resolveIgUsername('not-an-id', 'token-abc', okFetch), null);
});

test('username charset guard accepts real handle shapes only', () => {
  assert.ok(IG_USERNAME_RE.test('kamal.kumar'));
  assert.ok(IG_USERNAME_RE.test('keep_cue09'));
  assert.ok(!IG_USERNAME_RE.test(''));
  assert.ok(!IG_USERNAME_RE.test('has space'));
  assert.ok(!IG_USERNAME_RE.test('a'.repeat(31)));
});

test('buildBridgeBody carries a resolved username into the signed bytes', () => {
  const body = buildBridgeBody({
    appId: 'app1', recipientIgId: 'r1', igsid: 's1', messageId: 'm1',
    igUsername: 'kamal.kumar', forward: { kind: 'code', code: 'KQ-AAAA-BBBB' },
  });
  assert.equal(JSON.parse(body).igUsername, 'kamal.kumar');
  const without = buildBridgeBody({
    appId: 'app1', recipientIgId: 'r1', igsid: 's1', messageId: 'm1',
    igUsername: null, forward: { kind: 'code', code: 'KQ-AAAA-BBBB' },
  });
  assert.equal(JSON.parse(without).igUsername, undefined);
});
