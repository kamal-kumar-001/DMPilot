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
    async $queryRaw() { return [{ rateWindowCount: 1 }]; },
  };
  const svc = new ApiKeyService(prisma, { log: async (e) => audit.push(e) });
  return { svc, created, audit };
}

// 1. Default key is read-only.
{
  const { svc, created } = makeService();
  const res = await svc.createApiKey('u1', { name: 'agent key', expiresInDays: 90, allowAllAccounts: true});
  assert.deepEqual(res.scopes, DEFAULT_API_KEY_SCOPES);
  assert.deepEqual(created[0].scopes, ['read']);
  ok('new key defaults to read-only scope');
}

// 2. Unknown scope rejected.
{
  const { svc } = makeService();
  await assert.rejects(() => svc.createApiKey('u1', { name: 'k', scopes: ['admin:all'], expiresInDays: 90, allowAllAccounts: true}), /Unknown API key scope/);
  ok('unknown scope rejected at minting');
}

// 3. Unverified user cannot mint.
{
  const { svc } = makeService({ verified: false });
  await assert.rejects(() => svc.createApiKey('u1', { name: 'k', expiresInDays: 90, allowAllAccounts: true}), /Verify your email/);
  ok('unverified account cannot mint keys');
}

// 4. Account restriction must reference own accounts.
{
  const { svc } = makeService({ ownedAccounts: 1 });
  await assert.rejects(
    () => svc.createApiKey('u1', { name: 'k', instagramAccountIds: ['acc-1', 'acc-2'], expiresInDays: 90, allowAllAccounts: true}),
    /your own connected Instagram accounts/,
  );
  const okRes = await svc.createApiKey('u1', { name: 'k', instagramAccountIds: ['acc-1'], expiresInDays: 90, allowAllAccounts: true});
  assert.deepEqual(okRes.instagramAccountIds, ['acc-1']);
  ok('foreign account ids rejected, own accounts accepted');
}

// 5. Mint and revoke are audited.
{
  const { svc, audit } = makeService();
  await svc.createApiKey('u1', { name: 'k', expiresInDays: 90, allowAllAccounts: true});
  assert.ok(audit.some((a) => a.action === 'api_key.create'));
  ok('key minting writes an audit entry');
}

// 6. validateApiKey returns key context; expired key rejected.
{
  const live = {
    id: 'key-1', deletedAt: null, expiresAt: new Date(Date.now() + 86400000),
    scopes: ['read'], instagramAccountIds: ['acc-1'], allowAllAccounts: false,
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


// 12. Legacy keys with empty scopes column normalize to read-only.
{
  const prisma = {
    apiKey: {
      async findUnique() {
        return {
          id: 'legacy-1', deletedAt: null, expiresAt: new Date(Date.now() + 86400000), scopes: [], instagramAccountIds: [], allowAllAccounts: true,
          user: { id: 'u1', email: 'x@y.z', role: 'USER', isVerified: true },
        };
      },
    },
    async $queryRaw() { return [{ rateWindowCount: 1 }]; },
  };
  const svc = new ApiKeyService(prisma, { log: async () => {} });
  const res = await svc.validateApiKey('dmp_live_legacy');
  assert.deepEqual(res.apiKey.scopes, ['read']);
  const denied = checkApiKeyRequest(res.apiKey, ['campaigns:write'], null);
  assert.equal(denied.ok, false);
  const allowedRead = checkApiKeyRequest(res.apiKey, ['read'], null);
  assert.equal(allowedRead.ok, true);
  ok('legacy key (empty scopes) is read-only');
}

// 13. Expired keys are rejected at auth time.
{
  const prisma = {
    apiKey: {
      async findUnique() {
        return {
          id: 'exp-1', deletedAt: null, expiresAt: new Date(Date.now() - 86400000),
          scopes: ['read'], instagramAccountIds: [],
          user: { id: 'u1', email: 'x@y.z', role: 'USER', isVerified: true },
        };
      },
    },
  };
  const svc = new ApiKeyService(prisma, { log: async () => {} });
  const res = await svc.validateApiKey('dmp_live_expired');
  assert.equal(res, null);
  ok('expired key is rejected');
}

// 14. Per-key rate limit trips atomically once the window count exceeds the cap.
{
  const prisma = {
    apiKey: {
      async findUnique() {
        return {
          id: 'rl-1', deletedAt: null, expiresAt: new Date(Date.now() + 86400000), scopes: ['read'], instagramAccountIds: [], allowAllAccounts: true,
          rateLimitPerMin: 2,
          user: { id: 'u1', email: 'x@y.z', role: 'USER', isVerified: true },
        };
      },
    },
    async $queryRaw() { return [{ rateWindowCount: 3 }]; },
  };
  const svc = new ApiKeyService(prisma, { log: async () => {} });
  await assert.rejects(svc.validateApiKey('dmp_live_rl'), (e) => e.status === 429);
  ok('rate limit over the per-key cap returns 429');
}

// 15. Key-authenticated writes are attributed in the audit log.
{
  const audit = [];
  const svc = new ApiKeyService({ apiKey: {} }, { log: async (e) => audit.push(e) });
  svc.recordKeyAction('key-9', 'u1', 'POST', '/campaigns');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(audit[0].action, 'api_key.request');
  assert.match(audit[0].details, /key=key-9 POST \/campaigns/);
  ok('key write actions are audit-attributed to the key');
}

// 16. Restricted keys fail closed on campaign resource ids outside their allowlist.
{
  const svc = new ApiKeyService({
    campaign: { async findFirst() { return { instagramAccountId: 'ig-other' }; } },
    postPublish: { async findFirst() { return null; } },
  }, { log: async () => {} });
  const key = { id: 'k', instagramAccountIds: ['ig-1'] };
  const denied = await svc.assertKeyAccountAccess(key, { method: 'PATCH', path: '/campaigns/camp-9/status', params: { id: 'camp-9' }, body: {}, query: {} });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'account_not_in_key_scope');
  ok('restricted key denied on a campaign outside its account allowlist');
}

// 17. Restricted keys pass on resources inside their allowlist (param + body variants).
{
  const svc = new ApiKeyService({
    campaign: { async findFirst() { return { instagramAccountId: 'ig-1' }; } },
    postPublish: { async findFirst() { return { instagramAccountId: 'ig-1' }; } },
  }, { log: async () => {} });
  const key = { id: 'k', instagramAccountIds: ['ig-1'] };
  const a = await svc.assertKeyAccountAccess(key, { path: '/campaigns/camp-1', params: { id: 'camp-1' }, body: {}, query: {} });
  assert.equal(a.ok, true);
  const b = await svc.assertKeyAccountAccess(key, { path: '/content/publish', params: {}, body: { instagramAccountId: 'ig-1' }, query: {} });
  assert.equal(b.ok, true);
  const c = await svc.assertKeyAccountAccess(key, { path: '/instagram', params: {}, body: {}, query: { accountId: 'ig-1' } });
  assert.equal(c.ok, true);
  const d = await svc.assertKeyAccountAccess(key, { path: '/instagram/ig-1/verify-webhook', params: { id: 'ig-1' }, body: {}, query: {} });
  assert.equal(d.ok, true);
  ok('restricted key passes on in-allowlist resources (param, body, query variants)');
}

// 18. Key minting requires a finite expiry and explicit account mode.
{
  const { svc } = makeService();
  await assert.rejects(svc.createApiKey('u1', { name: 'no-expiry' }), /expiresInDays is required/);
  await assert.rejects(
    svc.createApiKey('u1', { name: 'no-accounts', expiresInDays: 30}),
    /explicitly pass allowAllAccounts/,
  );
  ok('minting without finite expiry or explicit account mode is rejected');
}

// 19. Explicit allowAllAccounts opt-in mints successfully.
{
  const { svc, created } = makeService();
  const res = await svc.createApiKey('u1', { name: 'all', expiresInDays: 30, allowAllAccounts: true});
  assert.equal(res.apiKey.startsWith('dmp_live_'), true);
  assert.equal(created[0].allowAllAccounts, true);
  ok('explicit all-accounts opt-in mints with finite expiry');
}

// 20. Rate-accounting infrastructure errors fail closed with a retryable 503.
{
  const prisma = {
    apiKey: {
      async findUnique() {
        return {
          id: 'rl-2', deletedAt: null, expiresAt: new Date(Date.now() + 86400000), scopes: ['read'], instagramAccountIds: [], allowAllAccounts: true,
          rateLimitPerMin: 60,
          user: { id: 'u1', email: 'x@y.z', role: 'USER', isVerified: true },
        };
      },
    },
    async $queryRaw() { throw new Error('db down'); },
  };
  const svc = new ApiKeyService(prisma, { log: async () => {} });
  await assert.rejects(svc.validateApiKey('dmp_live_rl2'), (e) => e.status === 503);
  ok('rate-accounting outage fails closed with 503');
}

// 21. Legacy keys without expiry are denied (reissue required).
{
  const prisma = {
    apiKey: {
      async findUnique() {
        return {
          id: 'leg-exp', deletedAt: null, expiresAt: null, scopes: ['read'], instagramAccountIds: [],
          allowAllAccounts: true,
          user: { id: 'u1', email: 'x@y.z', role: 'USER', isVerified: true },
        };
      },
    },
    async $queryRaw() { return [{ rateWindowCount: 1 }]; },
  };
  const svc = new ApiKeyService(prisma, { log: async () => {} });
  const res = await svc.validateApiKey('dmp_live_legacy_noexpiry');
  assert.equal(res, null);
  ok('legacy key without expiry is denied (reissue required)');
}

// 22. Legacy keys without explicit account mode are denied (reconfiguration required).
{
  const prisma = {
    apiKey: {
      async findUnique() {
        return {
          id: 'leg-acct', deletedAt: null, expiresAt: new Date(Date.now() + 86400000),
          scopes: ['read'], instagramAccountIds: [], allowAllAccounts: false,
          user: { id: 'u1', email: 'x@y.z', role: 'USER', isVerified: true },
        };
      },
    },
    async $queryRaw() { return [{ rateWindowCount: 1 }]; },
  };
  const svc = new ApiKeyService(prisma, { log: async () => {} });
  const res = await svc.validateApiKey('dmp_live_legacy_noacct');
  assert.equal(res, null);
  ok('legacy key without explicit account mode is denied (reconfiguration required)');
}
console.log(`RESULT ${passed} pass 0 fail`);
