// API-key least-privilege tests (phase 3 connector security).
// Run after a fresh API build: pnpm --filter @dmpilot/api build && node test/api-key-security.test.mjs
import assert from 'node:assert/strict';
import { ApiKeyService } from '../dist/auth/api-key.service.js';
import { RolesGuard } from '../dist/auth/guards/roles.guard.js';
import {
  checkApiKeyRequest,
  extractCandidateAccountId,
  DEFAULT_API_KEY_SCOPES,
} from '../dist/auth/utils/api-key-scopes.js';

let passed = 0;
function ok(name) { passed++; console.log(`  ${passed}. ${name}`); }

function makeService({ verified = true, ownedAccounts = 0, store = null } = {}) {
  const audit = [];
  const created = [];
  const prisma = {
    user: { async findUnique() { return { isVerified: verified }; } },
    instagramAccount: { async count() { return ownedAccounts; } },
    apiKey: {
      async create({ data }) { created.push(data); return { id: 'key-1', lastUsedAt: null, ...data }; },
      async findMany() { return []; },
      async findFirst() { return null; },
      async findUnique() { return store; },
      async update() { return {}; },
    },
    featureFlag: { async findUnique() { return { isEnabled: true }; } },
    auditLog: { async create({ data }) { audit.push(data); return data; } },
  };
  const svc = new ApiKeyService(prisma, { log: async (e) => audit.push(e) });
  return { svc, created, audit };
}

// 1. Default key is read-only.
{
  const { svc, created } = makeService();
  const res = await svc.createApiKey('u1', { name: 'agent key' });
  assert.deepEqual(res.scopes, DEFAULT_API_KEY_SCOPES);
  assert.deepEqual(created[0].scopes, ['read']);
  ok('new key defaults to read-only scope');
}

// 2. Unknown scope rejected.
{
  const { svc } = makeService();
  await assert.rejects(() => svc.createApiKey('u1', { name: 'k', scopes: ['admin:all'] }), /Unknown API key scope/);
  ok('unknown scope rejected at minting');
}

// 3. Unverified user cannot mint.
{
  const { svc } = makeService({ verified: false });
  await assert.rejects(() => svc.createApiKey('u1', { name: 'k' }), /Verify your email/);
  ok('unverified account cannot mint keys');
}

// 4. Account restriction must reference own accounts.
{
  const { svc } = makeService({ ownedAccounts: 1 });
  await assert.rejects(
    () => svc.createApiKey('u1', { name: 'k', instagramAccountIds: ['acc-1', 'acc-2'] }),
    /your own connected Instagram accounts/,
  );
  const okRes = await svc.createApiKey('u1', { name: 'k', instagramAccountIds: ['acc-1'] });
  assert.deepEqual(okRes.instagramAccountIds, ['acc-1']);
  ok('foreign account ids rejected, own accounts accepted');
}

// 5. Mint and revoke are audited.
{
  const { svc, audit } = makeService();
  await svc.createApiKey('u1', { name: 'k' });
  assert.ok(audit.some((a) => a.action === 'api_key.create'));
  ok('key minting writes an audit entry');
}

// 6. validateApiKey returns key context; expired key rejected.
{
  const live = {
    id: 'key-1', deletedAt: null, expiresAt: null,
    scopes: ['read'], instagramAccountIds: ['acc-1'],
    user: { id: 'u1', email: 'a@b.c', role: 'USER', isVerified: true },
  };
  const { svc } = makeService({ store: live });
  const res = await svc.validateApiKey('dmp_live_' + 'x'.repeat(48));
  assert.equal(res.apiKey.id, 'key-1');
  assert.deepEqual(res.apiKey.scopes, ['read']);
  assert.equal(res.user.id, 'u1');

  const expired = { ...live, expiresAt: new Date(Date.now() - 1000) };
  const { svc: svc2 } = makeService({ store: expired });
  assert.equal(await svc2.validateApiKey('dmp_live_' + 'x'.repeat(48)), null);
  ok('validate returns scopes/accounts context and rejects expired keys');
}

// 7. Undecorated route is denied for keys (fail closed default).
{
  const r = checkApiKeyRequest({ id: 'k', scopes: ['read'], instagramAccountIds: [] }, null, null);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'route_not_key_accessible');
  ok('route without @RequiresScopes denies API keys');
}

// 8. Read-only key denied on write route; scoped key allowed.
{
  const ro = checkApiKeyRequest({ id: 'k', scopes: ['read'], instagramAccountIds: [] }, ['campaigns:write'], null);
  assert.equal(ro.ok, false);
  assert.equal(ro.reason, 'missing_scope:campaigns:write');
  const rw = checkApiKeyRequest(
    { id: 'k', scopes: ['read', 'campaigns:write'], instagramAccountIds: [] },
    ['campaigns:write'],
    null,
  );
  assert.equal(rw.ok, true);
  ok('scope required and enforced per route');
}

// 9. Account restriction enforced; empty restriction = any own account.
{
  const key = { id: 'k', scopes: ['read'], instagramAccountIds: ['acc-1'] };
  assert.equal(checkApiKeyRequest(key, ['read'], 'acc-2').ok, false);
  assert.equal(checkApiKeyRequest(key, ['read'], 'acc-1').ok, true);
  assert.equal(checkApiKeyRequest({ ...key, instagramAccountIds: [] }, ['read'], 'acc-9').ok, true);
  ok('instagram account restriction enforced per key');
}

// 10. Candidate account extraction never treats generic :id as an account id.
{
  assert.equal(extractCandidateAccountId({ body: { instagramAccountId: 'a1' } }), 'a1');
  assert.equal(extractCandidateAccountId({ params: { accountId: 'a2' } }), 'a2');
  assert.equal(extractCandidateAccountId({ params: { id: 'campaign-9' } }), null);
  ok('candidate account extraction is field-precise');
}

// 11. RolesGuard: API keys never satisfy role routes; session admin still works.
{
  const reflector = { getAllAndOverride: () => ['ADMIN'] };
  const guard = new RolesGuard(reflector);
  const ctx = (req) => ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  });
  assert.equal(guard.canActivate(ctx({ user: { role: 'ADMIN' }, apiKey: { id: 'k' } })), false);
  assert.equal(guard.canActivate(ctx({ user: { role: 'ADMIN' } })), true);
  assert.equal(guard.canActivate(ctx({ user: { role: 'USER' } })), false);
  ok('keys denied on admin routes even when the owner is admin');
}

console.log(`RESULT ${passed} pass 0 fail`);
