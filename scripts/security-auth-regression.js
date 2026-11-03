/* eslint-disable @typescript-eslint/no-var-requires */
// Isolated security/auth regression harness for DMPilot API.
// Runs the REAL compiled services/controllers from apps/api/dist against
// in-memory mocks. No network, no DB, no live Meta/Instagram calls.
const crypto = require('crypto');
const path = require('path');
const API = process.env.DMPILOT_API_ROOT || path.join(__dirname, '..', 'apps', 'api');
const { EncryptionService } = require(
  path.join(API, 'dist/common/encryption/encryption.service.js'),
);
const { WebhookController } = require(path.join(API, 'dist/instagram/webhook.controller.js'));
const { InstagramService } = require(path.join(API, 'dist/instagram/instagram.service.js'));
const { AuthService } = require(path.join(API, 'dist/auth/auth.service.js'));

const META_SECRET = 'meta_app_secret_test';
const VERIFY_TOKEN = 'meta_verify_token_test';
const JWT_SECRET = 'jwt_secret_test';
const ENCRYPTION_KEY = 'encryption_key_test';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (e) {
    results.push(`FAIL  ${name} :: ${e.message}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
async function expectReject(fn, pattern, msg) {
  try {
    await fn();
  } catch (e) {
    expect(pattern.test(e.message), `${msg} (rejected with unexpected: ${e.message})`);
    return;
  }
  throw new Error(`${msg} (was accepted)`);
}

const configMap = {
  META_APP_SECRET: META_SECRET,
  INSTAGRAM_APP_SECRET: META_SECRET,
  META_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN,
  JWT_SECRET,
  ENCRYPTION_KEY,
};
const config = { get: (k) => configMap[k] };
const noopLogger = { setContext: () => {}, log: () => {}, warn: () => {}, error: () => {} };

function makeWebhookStack(over = {}) {
  const calls = { routed: [], events: [] };
  const prisma = {
    webhookEvent: {
      create: async ({ data }) => {
        const r = { id: `evt_${calls.events.length + 1}` };
        calls.events.push(data);
        return r;
      },
      update: async () => null,
    },
    systemSetting: { findUnique: async () => null },
  };
  const router = {
    route: async (id, body) => {
      calls.routed.push({ id, body });
    },
  };
  const cfg = { get: (k) => (k in over ? over[k] : configMap[k]) };
  const ctl = new WebhookController(cfg, prisma, noopLogger, router);
  return { ctl, calls };
}

function metaSig(body) {
  return 'sha256=' + crypto.createHmac('sha256', META_SECRET).update(body).digest('hex');
}
const sampleBody = JSON.stringify({ object: 'instagram', entry: [{ id: 'ig_1', changes: [] }] });

(async () => {
  // ---------------- Meta webhook ----------------
  function makeRes() {
    return {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(c) {
        this.statusCode = c;
        return {
          send: (b) => {
            this.body = b;
            return b;
          },
        };
      },
    };
  }

  await test('META: verification challenge with correct token succeeds', async () => {
    const { ctl } = makeWebhookStack();
    const res = makeRes();
    const r = ctl.verify('subscribe', 'challenge_123', VERIFY_TOKEN, res);
    expect(String(r) === 'challenge_123', 'challenge echoed');
  });

  await test('META: verification with wrong token rejected', async () => {
    const { ctl } = makeWebhookStack();
    await expectReject(
      async () => ctl.verify('subscribe', 'x', 'wrong_token', makeRes()),
      /mismatch/,
      'expected rejection',
    );
  });

  await test('META: POST rejected when app secret not configured (fail closed)', async () => {
    const { ctl } = makeWebhookStack({
      META_APP_SECRET: undefined,
      INSTAGRAM_APP_SECRET: undefined,
    });
    await expectReject(
      () =>
        ctl.receive({
          headers: { 'x-hub-signature-256': metaSig(sampleBody) },
          rawBody: sampleBody,
          body: JSON.parse(sampleBody),
        }),
      /not configured|mandatory|unavailable/i,
      'expected 5xx/401',
    );
  });

  await test('META: POST without signature header rejected', async () => {
    const { ctl, calls } = makeWebhookStack();
    await expectReject(
      () => ctl.receive({ headers: {}, rawBody: sampleBody, body: JSON.parse(sampleBody) }),
      /Missing webhook signature/,
      'expected 401',
    );
    expect(calls.routed.length === 0 && calls.events.length === 0, 'nothing persisted or routed');
  });

  await test('META: POST with invalid signature rejected, nothing persisted', async () => {
    const { ctl, calls } = makeWebhookStack();
    await expectReject(
      () =>
        ctl.receive({
          headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
          rawBody: sampleBody,
          body: JSON.parse(sampleBody),
        }),
      /Invalid webhook signature/,
      'expected 401',
    );
    expect(calls.routed.length === 0 && calls.events.length === 0, 'nothing persisted or routed');
  });

  await test('META: POST with valid signature is audited then routed', async () => {
    const { ctl, calls } = makeWebhookStack();
    const r = await ctl.receive({
      headers: { 'x-hub-signature-256': metaSig(sampleBody) },
      rawBody: sampleBody,
      body: JSON.parse(sampleBody),
    });
    expect(r.received === true, 'acknowledged');
    expect(calls.events.length === 1, 'event persisted for audit');
    await new Promise((res) => setImmediate(res));
    expect(calls.routed.length === 1, 'event routed');
  });

  // ---------------- EncryptionService ----------------
  const enc = new EncryptionService(config);
  const encOtherKey = new EncryptionService({ get: () => 'different_key' });

  await test('ENC: encrypt/decrypt roundtrip', async () => {
    const secret = 'IGAA_fake_access_token_123';
    const stored = enc.encrypt(secret);
    expect(enc.isEncrypted(stored), 'stored value matches ciphertext format');
    expect(stored !== secret && !stored.includes(secret), 'plaintext not present in stored value');
    expect(enc.decrypt(stored) === secret, 'decrypts to original');
  });

  await test('ENC: legacy plaintext passes through (positively identified)', async () => {
    expect(
      enc.decrypt('legacy_plaintext_token_abc') === 'legacy_plaintext_token_abc',
      'plaintext returned as-is',
    );
    expect(!enc.isEncrypted('legacy_plaintext_token_abc'), 'not flagged encrypted');
  });

  await test('ENC: ciphertext-format value under wrong key throws (never returned raw)', async () => {
    const stored = enc.encrypt('secret_token');
    await expectReject(
      async () => encOtherKey.decrypt(stored),
      /could not be decrypted/,
      'expected fail-closed error',
    );
  });

  await test('ENC: corrupted ciphertext throws (never returned raw)', async () => {
    const stored = enc.encrypt('secret_token');
    const parts = stored.split(':');
    parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith('00') ? 'ff' : '00'); // tamper tag
    await expectReject(
      async () => enc.decrypt(parts.join(':')),
      /could not be decrypted/,
      'expected fail-closed error',
    );
  });

  // ---------------- Instagram OAuth signed state ----------------
  const igSvc = Object.create(InstagramService.prototype);
  igSvc.configService = config;

  await test('OAUTH-STATE: signed state roundtrip returns userId', async () => {
    const state = igSvc.createSignedOAuthState('user_42');
    expect(igSvc.verifySignedOAuthState(state) === 'user_42', 'userId recovered');
  });

  await test('OAUTH-STATE: forged state for another user rejected', async () => {
    const state = igSvc.createSignedOAuthState('user_42');
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: 'attacker', ts: Date.now() }),
    ).toString('base64url');
    const forged = `${forgedPayload}.${state.slice(state.lastIndexOf('.') + 1)}`;
    await expectReject(
      async () => igSvc.verifySignedOAuthState(forged),
      /Invalid state signature/,
      'expected rejection',
    );
  });

  await test('OAUTH-STATE: expired state (>10min, validly signed) rejected', async () => {
    const payload = Buffer.from(
      JSON.stringify({ userId: 'user_42', ts: Date.now() - 11 * 60 * 1000 }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    await expectReject(
      async () => igSvc.verifySignedOAuthState(`${payload}.${sig}`),
      /expired/,
      'expected expiry rejection',
    );
  });

  await test('OAUTH-STATE: malformed state rejected', async () => {
    await expectReject(
      async () => igSvc.verifySignedOAuthState('not-a-state'),
      /Invalid state/,
      'expected rejection',
    );
    await expectReject(
      async () => igSvc.verifySignedOAuthState('@@@.@@@'),
      /Invalid state/,
      'expected rejection',
    );
  });

  // ---------------- Auth: register + refresh token hashing ----------------
  function makeAuthStack(db = { users: [], tokens: [] }) {
    const calls = { mails: [], audits: [] };
    const prisma = {
      user: {
        findUnique: async ({ where: { email } }) => db.users.find((u) => u.email === email) || null,
        create: async ({ data }) => {
          const r = { id: `u_${db.users.length + 1}`, ...data };
          db.users.push(r);
          return r;
        },
      },
      refreshToken: {
        findUnique: async ({ where: { token }, include }) => {
          const t = db.tokens.find((x) => x.token === token);
          if (!t) return null;
          return {
            ...t,
            user: {
              id: 'u_1',
              email: 'a@b.c',
              name: 'A',
              role: 'USER',
              isVerified: true,
              subscription: { plan: 'FREE' },
            },
          };
        },
        create: async ({ data }) => {
          db.tokens.push({ id: `rt_${db.tokens.length + 1}`, ...data });
        },
        update: async ({ where: { id }, data }) => {
          const t = db.tokens.find((x) => x.id === id);
          Object.assign(t, data);
          return t;
        },
        delete: async ({ where: { id } }) => {
          db.tokens = db.tokens.filter((x) => x.id !== id);
        },
        deleteMany: async () => ({}),
      },
    };
    const jwt = { signAsync: async () => 'signed.jwt.token' };
    const mail = {
      sendVerificationEmail: async (...a) => {
        calls.mails.push(a);
      },
    };
    const audit = {
      log: async (e) => {
        calls.audits.push(e);
      },
    };
    return { svc: new AuthService(prisma, jwt, mail, audit), db, calls, prisma };
  }

  await test('AUTH: duplicate email register throws ConflictException (no silent fail)', async () => {
    const { svc, db } = makeAuthStack();
    db.users.push({ id: 'u_0', email: 'dup@example.com' });
    await expectReject(
      () => svc.register({ email: 'dup@example.com', password: 'Secret123!', name: 'D' }),
      /already registered/,
      'expected 409 conflict',
    );
  });

  await test('AUTH: register hashes password, sends verification, no password in response', async () => {
    const { svc, db, calls } = makeAuthStack();
    const r = await svc.register({
      email: ' New@Example.com ',
      password: 'Secret123!',
      name: ' New ',
    });
    const stored = db.users.find((u) => u.email === 'new@example.com');
    expect(stored, 'email normalized to lowercase');
    expect(stored.password && stored.password.startsWith('$2'), 'password bcrypt-hashed');
    expect(stored.password !== 'Secret123!', 'plaintext never stored');
    expect(calls.mails.length === 1, 'verification email sent');
    expect(!JSON.stringify(r).includes('Secret123!'), 'no password in response');
  });

  await test('AUTH: refresh with hashed stored token succeeds, stays hashed', async () => {
    const { svc, db } = makeAuthStack();
    const raw = 'a'.repeat(128);
    const hashed = crypto.createHash('sha256').update(raw).digest('hex');
    db.tokens.push({ id: 'rt_1', token: hashed, expiresAt: new Date(Date.now() + 86400000) });
    const r = await svc.refresh({ refreshToken: raw });
    expect(r.accessToken === 'signed.jwt.token', 'new access token issued');
    expect(db.tokens[0].token === hashed, 'stored token remains the hash');
  });

  await test('AUTH: legacy raw stored token still works and is upgraded to hash', async () => {
    const { svc, db } = makeAuthStack();
    const raw = 'b'.repeat(128);
    db.tokens.push({ id: 'rt_1', token: raw, expiresAt: new Date(Date.now() + 86400000) });
    const r = await svc.refresh({ refreshToken: raw });
    expect(r.accessToken === 'signed.jwt.token', 'new access token issued');
    expect(
      db.tokens[0].token === crypto.createHash('sha256').update(raw).digest('hex'),
      'legacy token upgraded to hash',
    );
  });

  await test('AUTH: unknown refresh token rejected', async () => {
    const { svc } = makeAuthStack();
    await expectReject(
      () => svc.refresh({ refreshToken: 'c'.repeat(128) }),
      /invalid or expired/,
      'expected 401',
    );
  });

  await test('AUTH: expired refresh token rejected and deleted', async () => {
    const { svc, db } = makeAuthStack();
    const raw = 'd'.repeat(128);
    db.tokens.push({
      id: 'rt_1',
      token: crypto.createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() - 86400000),
    });
    await expectReject(
      () => svc.refresh({ refreshToken: raw }),
      /invalid or expired/,
      'expected 401',
    );
    expect(db.tokens.length === 0, 'expired token deleted');
  });

  console.log('\n===== RESULTS =====');
  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
