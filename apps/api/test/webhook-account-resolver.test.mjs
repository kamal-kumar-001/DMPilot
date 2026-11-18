// Isolated tests for webhook account resolution + verified alias binding.
// Run: node --experimental-strip-types test/webhook-account-resolver.test.mjs
import assert from 'node:assert/strict';
import {
  resolveActiveAccountForWebhookIds,
  bindVerifiedIdentifier,
  AliasConflictError,
} from '../src/instagram/webhook-account-resolver.ts';
// The binder imports the resolver extensionless (Nest/CommonJS style), which
// strip-types cannot resolve from source; import it from the compiled output.
const { bindViaMediaOwnershipProof } = await import('../dist/instagram/webhook-ownership-binder.js');

const KAMAL = 'user-kamal';
const DAKSH = 'user-daksh';

function mkAccount(over) {
  return {
    id: 'acc-1', userId: KAMAL, instagramId: '27400820022902831',
    instagramPageId: null, username: 'fakeeiitian',
    isConnected: true, deletedAt: null, ...over,
  };
}

// Mock prisma with the semantics the resolver relies on. `failNextCreate`
// simulates a concurrent bind winning the unique-constraint race.
function mkPrisma({ accounts = [], aliases = [], failNextCreate = false } = {}) {
  const active = (r) => r.isConnected === true && !r.deletedAt;
  const matchOr = (row, or) =>
    or.some((c) => {
      const ig = c.instagramId ? [].concat(c.instagramId.in ?? c.instagramId) : null;
      const pg = c.instagramPageId ? [].concat(c.instagramPageId.in ?? c.instagramPageId) : null;
      return (ig && ig.includes(row.instagramId)) || (pg && row.instagramPageId && pg.includes(row.instagramPageId));
    });
  const state = { accounts, aliases, failNextCreate };
  const api = {
    _state: state,
    instagramAccount: {
      async findFirst({ where }) {
        return accounts.find((a) =>
          (where.id ? a.id === where.id : true) &&
          (where.isConnected !== undefined ? a.isConnected === where.isConnected : true) &&
          (where.deletedAt === null ? !a.deletedAt : true)) ?? null;
      },
      async findMany({ where }) {
        if (where?.OR) return accounts.filter((a) => {
          const activeFilter = where.isConnected === undefined || a.isConnected === where.isConnected;
          const deletedFilter = where.deletedAt === undefined || (where.deletedAt === null) === !a.deletedAt;
          return activeFilter && deletedFilter && matchOr(a, where.OR);
        });
        return accounts;
      },
    },
    instagramAccountAlias: {
      async findMany({ where }) {
        let rows = aliases.filter((al) => !where?.identifier || [].concat(where.identifier.in ?? where.identifier).includes(al.identifier));
        return rows.map((al) => {
          const account = accounts.find((a) => a.id === al.accountId);
          if (where?.account && (!account || !active(account))) return null;
          return { ...al, id: al.id ?? `alias-${al.identifier}`, account };
        }).filter(Boolean);
      },
      async create({ data }) {
        if (state.failNextCreate) { state.failNextCreate = false; const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e; }
        if (aliases.some((al) => al.identifier === data.identifier)) { const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e; }
        const row = { ...data, id: `alias-${data.identifier}` };
        aliases.push(row);
        return row;
      },
    },
    async $transaction(fn) { return fn(api); },
  };
  return api;
}

const active = mkAccount();
const oldRow = mkAccount({ id: 'acc-old', instagramId: '17841458228090598', instagramPageId: '1246871588512294', isConnected: false, deletedAt: new Date('2026-10-03') });
const otherUser = mkAccount({ id: 'acc-other', userId: DAKSH, instagramId: '17841428441641365', instagramPageId: '109315502124961', username: 'dappipro' });
let n = 0;
const ok = (name) => console.log(`  ${++n}. ${name}`);

// Direct primary-column match (unchanged behavior).
{
  const prisma = mkPrisma({ accounts: [otherUser] });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841428441641365']);
  assert.equal(r.account?.id, 'acc-other');
  ok('primary column match resolves');
}

// Unknown id still drops (fail closed).
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['99999999999999999']);
  assert.equal(r.account, null);
  ok('unknown id drops');
}

// Soft-deleted predecessor row never resolves directly.
{
  const prisma = mkPrisma({ accounts: [active, oldRow] });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841458228090598']);
  assert.equal(r.account, null);
  ok('soft-deleted row does not resolve');
}

// Verified alias resolves (@fakeeiitian shape).
{
  const prisma = mkPrisma({
    accounts: [active, oldRow],
    aliases: [{ identifier: '17841458228090598', accountId: active.id, source: 'manual_operator' }],
  });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841458228090598']);
  assert.equal(r.account?.id, active.id);
  ok('verified alias resolves');
}

// Alias to an inactive target never resolves (handle-reuse scenario:
// the old account was deleted and the handle may have been reused).
{
  const prisma = mkPrisma({
    accounts: [active, oldRow],
    aliases: [{ identifier: '17841458228090598', accountId: oldRow.id, source: 'manual_operator' }],
  });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841458228090598']);
  assert.equal(r.account, null);
  ok('alias to inactive target fails closed');
}

// Message-path ambiguity: entry.id and recipientId resolving to DIFFERENT
// accounts must fail closed.
{
  const second = mkAccount({ id: 'acc-2', instagramId: '30000000000000001', username: 'other' });
  const prisma = mkPrisma({
    accounts: [active, second],
    aliases: [{ identifier: '17841458228090598', accountId: active.id, source: 'manual_operator' }],
  });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841458228090598', '30000000000000001']);
  assert.equal(r.account, null);
  assert.equal(r.ambiguous.length, 2);
  ok('conflicting entry/recipient candidates fail closed');
}

// Same user's second account: alias bound to account A never resolves for
// account B's own primary id.
{
  const b = mkAccount({ id: 'acc-b', instagramId: '40000000000000002', username: 'fakeeiitian2' });
  const prisma = mkPrisma({
    accounts: [active, b],
    aliases: [{ identifier: '17841458228090598', accountId: active.id, source: 'manual_operator' }],
  });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['40000000000000002']);
  assert.equal(r.account?.id, 'acc-b');
  ok('same-user second account resolves only to itself');
}

// Corrupt state: alias points at account X while the same identifier is
// another active account's primary id -> ambiguous, fail closed.
{
  const x = mkAccount({ id: 'acc-x', instagramId: '50000000000000003', username: 'x' });
  const prisma = mkPrisma({
    accounts: [active, x],
    aliases: [{ identifier: '50000000000000003', accountId: active.id, source: 'manual_operator' }],
  });
  const r = await resolveActiveAccountForWebhookIds(prisma, ['50000000000000003']);
  assert.equal(r.account, null);
  assert.ok(r.ambiguous);
  ok('primary/alias disagreement fails closed');
}

// Binding: happy path.
{
  const prisma = mkPrisma({ accounts: [active, oldRow] });
  const { id, warnings } = await bindVerifiedIdentifier(prisma, {
    accountId: active.id, identifier: '17841458228090598', source: 'manual_operator', note: 'evidence ref',
  });
  assert.ok(id);
  assert.equal(warnings.length, 1); // inactive predecessor primary-id warning
  assert.ok(warnings[0].includes('acc-old'));
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841458228090598']);
  assert.equal(r.account?.id, active.id);
  ok('reviewed bind of inactive predecessor id succeeds (with warning) and resolves');
}

// Binding refuses: identifier is another account's primary id (cross-user).
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  await assert.rejects(
    bindVerifiedIdentifier(prisma, { accountId: active.id, identifier: '17841428441641365', source: 'manual_operator', note: 'x' }),
    (e) => e instanceof AliasConflictError && e.conflicts.includes('acc-other'),
  );
  ok('bind refuses collision with another user\'s primary id');
}

// Binding an inactive row's other primary id also succeeds with a warning
// (same reviewed-migration class), and both aliases resolve.
{
  const prisma = mkPrisma({ accounts: [active, oldRow] });
  const { warnings } = await bindVerifiedIdentifier(prisma, {
    accountId: active.id, identifier: '1246871588512294', source: 'manual_operator', note: 'x',
  });
  assert.equal(warnings.length, 1);
  const r = await resolveActiveAccountForWebhookIds(prisma, ['1246871588512294']);
  assert.equal(r.account?.id, active.id);
  ok('reviewed bind of inactive page id succeeds (with warning)');
}

// Binding refuses: inactive target.
{
  const prisma = mkPrisma({ accounts: [active, oldRow] });
  await assert.rejects(
    bindVerifiedIdentifier(prisma, { accountId: oldRow.id, identifier: '60000000000000004', source: 'manual_operator', note: 'x' }),
    AliasConflictError,
  );
  ok('bind refuses inactive target');
}

// Binding refuses: double binding.
{
  const prisma = mkPrisma({
    accounts: [active],
    aliases: [{ identifier: '70000000000000005', accountId: active.id, source: 'manual_operator' }],
  });
  await assert.rejects(
    bindVerifiedIdentifier(prisma, { accountId: active.id, identifier: '70000000000000005', source: 'manual_operator', note: 'x' }),
    AliasConflictError,
  );
  ok('bind refuses double binding');
}

// Binding race: concurrent bind wins -> unique violation -> AliasConflictError.
{
  const prisma = mkPrisma({ accounts: [active], failNextCreate: true });
  await assert.rejects(
    bindVerifiedIdentifier(prisma, { accountId: active.id, identifier: '80000000000000006', source: 'manual_operator', note: 'x' }),
    (e) => e instanceof AliasConflictError,
  );
  ok('concurrent bind surfaces as conflict, writes nothing');
}

// Binding refuses non-numeric identifiers.
{
  const prisma = mkPrisma({ accounts: [active] });
  await assert.rejects(
    bindVerifiedIdentifier(prisma, { accountId: active.id, identifier: 'abc123', source: 'manual_operator', note: 'x' }),
    AliasConflictError,
  );
  ok('bind refuses non-numeric identifier');
}

// Ownership-proof binder: exactly one proving account binds and resolves.
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  // provider returns immutable owner id only when the token's user created it
  const probe = async (mediaId, token) => (token === 'TOKEN_KAMAL' ? { id: mediaId, ownerId: active.instagramId } : null);
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '17841458228090598', mediaId: 'media-1', probe,
    candidates: [
      { id: active.id, instagramId: active.instagramId, accessToken: 'TOKEN_KAMAL' },
      { id: otherUser.id, instagramId: otherUser.instagramId, accessToken: 'TOKEN_DAKSH' },
    ],
  });
  assert.equal(res.bound, true);
  assert.equal(res.accountId, active.id);
  const r = await resolveActiveAccountForWebhookIds(prisma, ['17841458228090598']);
  assert.equal(r.account?.id, active.id);
  ok('media ownership proof binds exactly one winner');
}

// No account can read the media -> nothing bound, nothing written.
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '17841458228090598', mediaId: 'media-x', probe: async () => null,
    candidates: [{ id: active.id, instagramId: active.instagramId, accessToken: 'T1' }],
  });
  assert.equal(res.bound, false);
  assert.equal(res.reason, 'no_proof');
  assert.equal(prisma._state.aliases.length, 0);
  ok('no proof binds nothing');
}

// Two accounts can read the media (should never happen) -> fail closed.
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '17841458228090598', mediaId: 'media-1',
    probe: async (m, token) => ({ id: m, ownerId: token === 'T1' ? active.instagramId : otherUser.instagramId }),
    candidates: [
      { id: active.id, instagramId: active.instagramId, accessToken: 'T1' },
      { id: otherUser.id, instagramId: otherUser.instagramId, accessToken: 'T2' },
    ],
  });
  assert.equal(res.bound, false);
  assert.equal(res.reason, 'multiple_proof');
  assert.equal(prisma._state.aliases.length, 0);
  ok('multiple proofs fail closed');
}

// Probe errors are swallowed as no-proof, never a negative identity claim.
{
  const prisma = mkPrisma({ accounts: [active] });
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '90000000000000007', mediaId: 'media-1',
    probe: async () => { throw new Error('OAuthException'); },
    candidates: [{ id: active.id, instagramId: active.instagramId, accessToken: 'T1' }],
  });
  assert.equal(res.bound, false);
  assert.equal(res.reason, 'no_proof');
  ok('probe error = no proof');
}

// Proof winner but identifier collides with an ACTIVE primary -> conflict, no write.
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '17841428441641365', mediaId: 'media-1',
    probe: async (m) => ({ id: m, ownerId: active.instagramId }),
    candidates: [{ id: active.id, instagramId: active.instagramId, accessToken: 'T1' }],
  });
  assert.equal(res.bound, false);
  assert.equal(res.reason, 'bind_conflict');
  assert.equal(prisma._state.aliases.length, 0);
  ok('bind conflict swallowed to fail-closed result');
}

// Success-only read (media readable but owner NOT returned, e.g. another
// account's public media) must NOT bind.
{
  const prisma = mkPrisma({ accounts: [active] });
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '17841458228090598', mediaId: 'media-pub',
    probe: async (m) => ({ id: m }), // no ownerId
    candidates: [{ id: active.id, instagramId: active.instagramId, accessToken: 'T1' }],
  });
  assert.equal(res.bound, false);
  assert.equal(res.reason, 'no_proof');
  assert.equal(prisma._state.aliases.length, 0);
  ok('success-only read without owner id is not proof');
}

// Owner id returned but matching a DIFFERENT candidate must not bind this one.
{
  const prisma = mkPrisma({ accounts: [active, otherUser] });
  const res = await bindViaMediaOwnershipProof(prisma, {
    identifier: '17841458228090598', mediaId: 'media-1',
    probe: async (m, token) => ({ id: m, ownerId: otherUser.instagramId }), // owner = daksh, but only kamal is a candidate
    candidates: [{ id: active.id, instagramId: active.instagramId, accessToken: 'T1' }],
  });
  assert.equal(res.bound, false);
  assert.equal(res.reason, 'no_proof');
  assert.equal(prisma._state.aliases.length, 0);
  ok('owner id mismatch does not bind');
}

console.log(`webhook-account-resolver: all ${n} tests passed`);
