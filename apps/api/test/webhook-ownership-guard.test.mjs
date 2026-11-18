// Probe-guard abuse-bounding tests for webhook-ownership-binder.ts
import assert from 'node:assert/strict';
import {
  bindViaMediaOwnershipProof,
  validateProbeGuardConfig,
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

// 1. repeated miss: negative cache suppresses re-probe
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const g = { store };
  const r1 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99990', mediaId: 'M1', candidates, probe, guard: g });
  assert.equal(r1.reason, 'no_proof'); assert.equal(probes, 2);
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99990', mediaId: 'M1', candidates, probe, guard: g });
  assert.equal(r2.reason, 'probe_skipped'); assert.equal(probes, 2);
  ok('repeated miss: negative cache suppresses re-probe (0 extra API calls)');
}

// 2. unique-key flood with per-CALL budget: hard cap on actual Meta calls
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const g = { store, config: { maxCallsPerWindow: 3 } };
  const outcomes = [];
  for (let i = 0; i < 6; i++) {
    const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99991', mediaId: 'N' + i, candidates, probe, guard: g });
    outcomes.push(r.reason);
  }
  assert.equal(probes, 3); // hard cap on actual Meta calls, not probe runs
  assert.equal(outcomes[0], 'no_proof');
  assert.ok(outcomes.slice(1).every((o) => o === 'budget_exceeded'));
  ok('unique-key flood: per-call budget caps actual Meta calls, overflow fails closed');
}

// 3. simultaneous same-key: pending lock allows exactly one scan
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; await new Promise((r) => setTimeout(r, 20)); return null; };
  const g = { store };
  const [r1, r2] = await Promise.all([
    bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99992', mediaId: 'M9', candidates, probe, guard: g }),
    bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99992', mediaId: 'M9', candidates, probe, guard: g }),
  ]);
  assert.equal([r1, r2].filter((r) => r.reason === 'no_proof').length, 1);
  assert.equal([r1, r2].filter((r) => r.reason === 'probe_skipped').length, 1);
  ok('simultaneous same-key events: single scan, other fails closed');
}

// 4a. store failure: fail closed, zero probes
{
  const store = makeStore(true);
  let probes = 0;
  const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99993', mediaId: 'M1', candidates, probe: async () => { probes++; return null; }, guard: { store } });
  assert.equal(r.reason, 'probe_skipped'); assert.equal(probes, 0);
  ok('store failure: fail closed with zero probes');
}

// 4b. invalid budget env value: coerced to safe default
{
  const cfg = validateProbeGuardConfig({ maxCallsPerWindow: 0, eventDeadlineMs: -5 });
  assert.ok(cfg.maxCallsPerWindow > 0 && cfg.eventDeadlineMs > 0);
  ok('config validation: non-positive values coerced to safe defaults');
}

// 5. successful bind: key cached as bound, subsequent event performs zero probes
{
  const store = makeStore();
  let probes = 0;
  const probe = async (_m, token) => { probes++; return token === 't1' ? { id: 'M5', ownerId: '111' } : null; };
  const g = { store };
  const r1 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99995', mediaId: 'M5', candidates, probe, guard: g });
  assert.equal(r1.bound, true); assert.equal(probes, 2);
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99995', mediaId: 'M5', candidates, probe, guard: g });
  assert.equal(r2.reason, 'probe_skipped'); assert.equal(probes, 2);
  ok('success then zero extra probes for the same key');
}

// 6. ambiguous proof: no bind, negative-cached, repeat skipped
{
  const store = makeStore();
  const probe = async (_m, token) => ({ id: 'M6', ownerId: token === 't1' ? '111' : '222' });
  const g = { store };
  const r1 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99996', mediaId: 'M6', candidates, probe, guard: g });
  assert.equal(r1.bound, false); assert.equal(r1.reason, 'multiple_proof');
  let probes = 0;
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99996', mediaId: 'M6', candidates, probe: async () => { probes++; return null; }, guard: g });
  assert.equal(r2.reason, 'probe_skipped'); assert.equal(probes, 0);
  ok('ambiguous (multiple proof): no bind, negative-cached, repeat skipped');
}

// 7. per-event deadline: slow probes stop the scan, fail closed
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; await new Promise((r) => setTimeout(r, 80)); return null; };
  const g = { store, config: { eventDeadlineMs: 30, perCallTimeoutMs: 200 } };
  const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99997', mediaId: 'M7', candidates, probe, guard: g });
  assert.equal(r.reason, 'deadline'); assert.equal(probes, 1);
  ok('per-event deadline: scan stops and fails closed');
}

// 8. per-call hard timeout: never-resolving probe bounded, scan completes
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; return new Promise(() => {}); };
  const g = { store, config: { perCallTimeoutMs: 30, eventDeadlineMs: 5_000 } };
  const t0 = Date.now();
  const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99998', mediaId: 'M8', candidates, probe, guard: g });
  assert.equal(r.reason, 'no_proof'); assert.equal(probes, 2);
  assert.ok(Date.now() - t0 < 2_000);
  ok('per-call timeout: hung probes bounded, scan completes without bind');
}

// 9. candidate cap: at most maxCandidatesPerEvent calls per event
{
  const store = makeStore();
  let probes = 0;
  const probe = async () => { probes++; return null; };
  const g = { store, config: { maxCandidatesPerEvent: 1 } };
  const r = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99999', mediaId: 'M10', candidates, probe, guard: g });
  assert.equal(r.reason, 'no_proof'); assert.equal(probes, 1);
  ok('candidate cap: at most maxCandidatesPerEvent calls per event');
}

// 10. pending lock held while a scan is still in flight; lock TTL floor enforced
{
  const cfg = validateProbeGuardConfig({ eventDeadlineMs: 45_000, perCallTimeoutMs: 10_000, pendingTtlMs: 1_000 });
  assert.ok(cfg.pendingTtlMs >= 45_000 + 10_000 + 5_000);
  const store = makeStore();
  const slowProbe = async () => { await new Promise((r) => setTimeout(r, 60)); return { id: 'M11', ownerId: '111' }; };
  const g = { store };
  const p1 = bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99989', mediaId: 'M11', candidates, probe: slowProbe, guard: g });
  await new Promise((r) => setTimeout(r, 20)); // scan 1 still in flight
  const r2 = await bindViaMediaOwnershipProof(dummyPrisma, { identifier: '99989', mediaId: 'M11', candidates, probe: async () => null, guard: g });
  assert.equal(r2.reason, 'probe_skipped');
  const r1 = await p1;
  assert.equal(r1.bound, true);
  ok('pending lock held while scan in flight; lock TTL floor enforced');
}

console.log(`webhook-ownership-guard: all ${passed} tests passed`);
