// Probe-guard abuse-bounding tests for webhook-ownership-binder.ts
import assert from 'node:assert/strict';
import {
  bindViaMediaOwnershipProof,
  DEFAULT_PROBE_GUARD_CONFIG,
} from '../dist/instagram/webhook-ownership-binder.js';

let passed = 0;
function ok(name) { passed++; console.log(`  ${passed}. ${name}`); }

function makeStore(fail = false) {
  const keys = new Map();
  const windows = new Map();
  return {
    async setNxPx(key, _v, ttlMs) {
      if (fail) throw new Error('store down');
      const exp = keys.get(key);
      if (exp !== undefined && exp > Date.now()) return false;
      keys.set(key, Date.now() + ttlMs);
      return true;
    },
    async setPx(key, _v, ttlMs) {
      if (fail) throw new Error('store down');
      keys.set(key, Date.now() + ttlMs);
    },
    async incrWithExpiry(key, windowMs) {
      if (fail) throw new Error('store down');
      const now = Date.now();
      const w = windows.get(key);
      if (!w || w.exp <= now) { windows.set(key, { n: 1, exp: now + windowMs }); return 1; }
      w.n += 1; return w.n;
    },
  };
}

const dummyPrisma = {
  instagramAccount: {
    async findFirst() { return { id: 'acc-1', userId: 'u1', instagramId: '111', instagramPageId: null, username: 'a', isConnected: true, deletedAt: null }; },
    async findMany() { return []; },
  },
  instagramAccountAlias: {
    async findMany() { return []; },
    async create(args) { return { id: 'alias-1', ...args.data }; },
  },
  async $transaction(fn) { return fn(this); },
};

const candidates = [
  { id: 'acc-1', instagramId: '111', accessToken: 't1' },
  { id: 'acc-2', instagramId: '222', accessToken: 't2' },
];
const noProofProbe = async () => null;

// 1. repeated miss: second event on same key performs zero new probes
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const g = { store, config: { ...DEFAULT_PROBE_GUARD_CONFIG } };
  const r1 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M1', candidates, probe, guard: g });
  assert.equal(r1.bound, false); assert.equal(r1.reason, 'no_proof');
  assert.equal(probes, 2);
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M1', candidates, probe, guard: g });
  assert.equal(r2.reason, 'probe_skipped');
  assert.equal(probes, 2);
  ok('repeated miss: negative cache suppresses re-probe (0 extra API calls)');
}

// 2. unique-key flood: global budget caps probe runs across unique keys
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const g = { store, config: { ...DEFAULT_PROBE_GUARD_CONFIG, budgetPerWindow: 5 } };
  let skipped = 0;
  for (let i = 0; i < 8; i++) {
    const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M' + i, candidates, probe, guard: g });
    if (r.reason === 'probe_skipped') skipped++;
  }
  assert.equal(probes, 10); // 5 runs x 2 candidates
  assert.equal(skipped, 3);
  ok('unique-key flood: global budget caps probe runs, overflow fails closed');
}

// 3. simultaneous same-key: pending lock allows exactly one probe run
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; await new Promise(r => setTimeout(r, 10)); return null; };
  const g = { store, config: { ...DEFAULT_PROBE_GUARD_CONFIG } };
  const [r1, r2] = await Promise.all([
    bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M9', candidates, probe, guard: g }),
    bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M9', candidates, probe, guard: g }),
  ]);
  const runs = [r1, r2].filter(r => r.reason === 'no_proof').length;
  const skips = [r1, r2].filter(r => r.reason === 'probe_skipped').length;
  assert.equal(runs, 1); assert.equal(skips, 1); assert.equal(probes, 2);
  ok('simultaneous same-key events: single probe run, other fails closed');
}

// 4a. store failure: fail closed, zero probes
{
  const store = makeStore(true);
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M1', candidates, probe, guard: { store } });
  assert.equal(r.reason, 'probe_skipped'); assert.equal(probes, 0);
  ok('store failure: fail closed with zero probes');
}

// 4b. budget exhausted: zero probes
{
  const store = makeStore();
  const g = { store, config: { ...DEFAULT_PROBE_GUARD_CONFIG, budgetPerWindow: 0 } };
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M1', candidates, probe, guard: g });
  assert.equal(r.reason, 'probe_skipped'); assert.equal(probes, 0);
  ok('budget exhaustion: fail closed with zero probes');
}

// 5. successful bind: key completed as bound, subsequent event performs zero probes
{
  const store = makeStore();
  let probes = 0;
  const probe = async (mediaId, token) => { probes++; return token === 't1' ? { id: 'M5', ownerId: '111' } : null; };
  const g = { store, config: { ...DEFAULT_PROBE_GUARD_CONFIG } };
  const r1 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99999', mediaId: 'M5', candidates, probe, guard: g });
  assert.equal(r1.bound, true); assert.equal(probes, 2); // winner found first, second candidate still probed (no early break on one win)
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99999', mediaId: 'M5', candidates, probe, guard: g });
  assert.equal(r2.reason, 'probe_skipped'); assert.equal(probes, 2);
  ok('success then zero extra probes for the same key');
}

// 6. ambiguous proof: binds nothing, key completed, repeat event skipped
{
  const store = makeStore();
  const probe = async (mediaId, token) => ({ id: 'M6', ownerId: token === 't1' ? '111' : '222' });
  const g = { store, config: { ...DEFAULT_PROBE_GUARD_CONFIG } };
  const r1 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M6', candidates, probe, guard: g });
  assert.equal(r1.bound, false); assert.equal(r1.reason, 'multiple_proof');
  let probes = 0;
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: 'X', mediaId: 'M6', candidates, probe: async () => { probes++; return null; }, guard: g });
  assert.equal(r2.reason, 'probe_skipped'); assert.equal(probes, 0);
  ok('ambiguous (multiple proof): no bind, negative-cached, repeat skipped');
}

console.log(`webhook-ownership-guard: all ${passed} tests passed`);
