const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('../../apps/api/node_modules/reflect-metadata');
const { ApiKeyService } = require('../../apps/api/dist/auth/api-key.service');
const { JwtAuthGuard } = require('../../apps/api/dist/auth/guards/jwt-auth.guard');

test('ApiKeyService creates secure SHA-256 hashed keys and never stores plaintext', async () => {
  let savedRecord = null;
  const mockPrisma = {
    apiKey: {
      create: async ({ data }) => {
        savedRecord = { id: 'key-123', ...data, createdAt: new Date(), lastUsedAt: null };
        return savedRecord;
      },
      findUnique: async () => null,
      findMany: async () => [],
      update: async () => ({}),
    },
  };

  const service = new ApiKeyService(mockPrisma);
  const result = await service.createApiKey('user-1', {
    name: 'Claude Code Agent',
    expiresInDays: 30,
  });

  // Verify format
  assert.match(result.apiKey, /^dmp_live_[a-f0-9]{48}$/);
  assert.equal(result.name, 'Claude Code Agent');
  assert.ok(result.prefix.startsWith('dmp_live_'));
  assert.ok(result.prefix.endsWith('...'));

  // Verify secret is NOT stored in plaintext
  assert.notEqual(savedRecord.keyHash, result.apiKey);
  // Verify it is the SHA-256 hash of raw key
  const expectedHash = crypto.createHash('sha256').update(result.apiKey).digest('hex');
  assert.equal(savedRecord.keyHash, expectedHash);
  assert.equal(savedRecord.userId, 'user-1');
  assert.ok(savedRecord.expiresAt instanceof Date);
});

test('ApiKeyService validates active keys and rejects expired/revoked keys', async () => {
  const rawKey = 'dmp_live_' + 'a'.repeat(48);
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const mockUser = { id: 'u-123', email: 'agent@dmpilot.org', role: 'CREATOR', isVerified: true };

  let activeRecord = {
    id: 'key-1',
    keyHash,
    deletedAt: null,
    expiresAt: new Date(Date.now() + 100000),
    user: mockUser,
  };

  const mockPrisma = {
    apiKey: {
      findUnique: async ({ where }) => {
        if (where.keyHash === keyHash) return activeRecord;
        return null;
      },
      update: async () => ({}),
    },
  };

  const service = new ApiKeyService(mockPrisma);

  // 1. Valid key
  const validatedUser = await service.validateApiKey(rawKey);
  assert.deepEqual(validatedUser, mockUser);

  // 2. Expired key
  activeRecord.expiresAt = new Date(Date.now() - 1000);
  const expiredUser = await service.validateApiKey(rawKey);
  assert.equal(expiredUser, null);

  // 3. Revoked / deleted key
  activeRecord.expiresAt = new Date(Date.now() + 100000);
  activeRecord.deletedAt = new Date();
  const revokedUser = await service.validateApiKey(rawKey);
  assert.equal(revokedUser, null);

  // 4. Unknown key
  const unknownUser = await service.validateApiKey('dmp_live_' + 'f'.repeat(48));
  assert.equal(unknownUser, null);
});

test('JwtAuthGuard supports Authorization Bearer dmp_live_... and x-api-key headers', async () => {
  const rawKey = 'dmp_live_' + 'b'.repeat(48);
  const mockUser = { id: 'agent-1', email: 'bot@dmpilot.org', role: 'CREATOR', isVerified: true };

  const mockApiKeyService = {
    validateApiKey: async (key) => {
      if (key === rawKey) return mockUser;
      return null;
    },
  };

  const guard = new JwtAuthGuard(mockApiKeyService);

  // Test Bearer token
  const req1 = { headers: { authorization: `Bearer ${rawKey}` } };
  const ctx1 = { switchToHttp: () => ({ getRequest: () => req1 }) };
  const res1 = await guard.canActivate(ctx1);
  assert.equal(res1, true);
  assert.deepEqual(req1.user, mockUser);

  // Test x-api-key header
  const req2 = { headers: { 'x-api-key': rawKey } };
  const ctx2 = { switchToHttp: () => ({ getRequest: () => req2 }) };
  const res2 = await guard.canActivate(ctx2);
  assert.equal(res2, true);
  assert.deepEqual(req2.user, mockUser);

  // Test invalid key throws 401
  const req3 = { headers: { 'x-api-key': 'dmp_live_invalid' } };
  const ctx3 = { switchToHttp: () => ({ getRequest: () => req3 }) };
  await assert.rejects(guard.canActivate(ctx3), (err) => err.status === 401);
});
