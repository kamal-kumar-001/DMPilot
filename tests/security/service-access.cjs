const { test } = require('node:test'),
  assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { ServiceAccessService } = require('../../apps/api/dist/billing/service-access.service');
const original = () => ({
  grantId: 'g1',
  merchantId: 'm1',
  sessionId: 's1',
  orderId: 'o1',
  amountPaise: 354,
  baseAmountPaise: 354,
  currency: 'INR',
  serviceKind: 'REVOCABLE_SUBSCRIPTION',
  state: 'PROVISIONAL',
  revision: 1,
  issuedAt: '2026-11-04T07:00:00.000Z',
  expiresAt: null,
  provenance: 'MAILBOX_OBSERVED_UNVERIFIED_BANK',
  bankVerified: false,
  paymentStatus: 'UNVERIFIED',
});
function fixture() {
  const rows = new Map([
    ['feefree_service_order:s1', { key: 'feefree_service_order:s1', value: 'enrolled' }],
  ]);
  let live = original(),
    enabled = true;
  const prisma = {
    paymentSession: {
      findUnique: async () => ({
        sessionId: 's1',
        provider: 'feefree',
        orderId: 'o1',
        currency: 'INR',
        amountPaise: 354,
        baseAmountPaise: 354,
        plan: 'PRO',
        cycle: 'MONTHLY',
        userId: 'u1',
      }),
    },
    systemSetting: {
      findUnique: async ({ where }) => rows.get(where.key),
      findMany: async () =>
        [...rows.values()].filter((r) => r.key.startsWith('feefree_service_grant:')),
      create: async ({ data }) => {
        assert(!rows.has(data.key));
        rows.set(data.key, data);
      },
      updateMany: async ({ where, data }) => {
        if (rows.get(where.key)?.value !== where.value) return { count: 0 };
        rows.set(where.key, { ...rows.get(where.key), ...data });
        return { count: 1 };
      },
      upsert: async () => {},
    },
  };
  prisma.$transaction = async (f) => f(prisma);
  const provider = { getServiceGrant: async () => live, revokeServiceGrant: async () => live };
  const service = new ServiceAccessService(prisma, provider, {
    get: () => (enabled ? 'true' : 'false'),
  });
  return {
    service,
    rows,
    provider,
    get live() {
      return live;
    },
    set live(v) {
      live = v;
    },
    disable() {
      enabled = false;
    },
  };
}
const base = { userId: 'u1', plan: 'FREE', cycle: 'MONTHLY', expiresAt: null };
test('grant exact ACK and effective plan without modifying paid records;duplicate period stable', async () => {
  const f = fixture(),
    g = f.live;
  assert.deepEqual(await f.service.accept('service.access.provisional', 'e1', g), {
    handled: true,
    eventId: 'e1',
    grantId: 'g1',
    revision: 1,
  });
  const before = f.rows.get('feefree_service_grant:g1').value;
  await f.service.accept('service.access.provisional', 'e1', g);
  assert.equal(
    JSON.parse(before).periodEnd,
    JSON.parse(f.rows.get('feefree_service_grant:g1').value).periodEnd,
  );
  const result = await f.service.effective(base);
  assert.equal(result.plan, 'PRO');
  assert.equal(result.paymentStatus, 'UNVERIFIED');
  assert.equal(result.bankVerified, false);
  assert.equal((await f.service.effective({ ...base, plan: 'ENTERPRISE' })).plan, 'ENTERPRISE');
});
test('revoke before grant terminal and original period never restarted', async () => {
  const f = fixture(),
    g = f.live;
  f.live = { ...g, state: 'REVOKED', revision: 2 };
  await f.service.accept('service.access.revoked', 'e2', f.live);
  f.live = g;
  await f.service.accept('service.access.provisional', 'e1', g);
  assert.equal((await f.service.effective(base)).plan, 'FREE');
  assert.equal(JSON.parse(f.rows.get('feefree_service_grant:g1').value).grant.state, 'REVOKED');
});
test('reject mismatched lookup,order,amount,provenance,artificial expiry or unenrolled checkout', async () => {
  for (const patch of [
    { amountPaise: 1 },
    { orderId: 'wrong' },
    { bankVerified: true },
    { expiresAt: new Date().toISOString() },
    { provenance: 'BANK_VERIFIED' },
  ]) {
    const f = fixture();
    await assert.rejects(
      f.service.accept('service.access.provisional', 'e1', { ...f.live, ...patch }),
    );
  }
  const f = fixture();
  f.rows.delete('feefree_service_order:s1');
  await assert.rejects(f.service.accept('service.access.provisional', 'e1', f.live));
});
test('provider failure/revoke/period end removes overlay while paid plan stays;disabled denies grants', async () => {
  const f = fixture();
  await f.service.accept('service.access.provisional', 'e1', f.live);
  f.provider.getServiceGrant = async () => {
    throw Error('offline');
  };
  assert.equal((await f.service.effective(base)).plan, 'FREE');
  assert.equal((await f.service.effective({ ...base, plan: 'PRO' })).plan, 'PRO');
  f.disable();
  await assert.rejects(f.service.accept('service.access.provisional', 'e1', f.live));
  assert.equal((await f.service.effective(base)).plan, 'FREE');
});
test('signed FeeFree envelope through real controller yields exact ACK,lookup,revocation and no paid fulfillment', async () => {
  const crypto = require('node:crypto');
  const {
    FeeFreeWebhookController,
  } = require('../../apps/api/dist/billing/feefree-webhook.controller');
  const f = fixture();
  let paid = 0;
  const c = new FeeFreeWebhookController(
    {
      fulfillFeeFreePayment: async () => {
        paid++;
        throw Error('wrong lane');
      },
    },
    { get: () => 'synthetic-contract-secret' },
    f.service,
  );
  const deliver = async (event, g, eventId) => {
    const payload = {
      event,
      timestamp: Date.now(),
      data: { event, eventId, timestamp: g.issuedAt, ...g },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature =
      'sha256=' +
      crypto.createHmac('sha256', 'synthetic-contract-secret').update(rawBody).digest('hex');
    return c.handleWebhook(signature, String(payload.timestamp), { rawBody, body: payload });
  };
  assert.deepEqual(await deliver('service.access.provisional', f.live, 'e1'), {
    handled: true,
    eventId: 'e1',
    grantId: 'g1',
    revision: 1,
  });
  assert.equal((await f.service.effective(base)).plan, 'PRO');
  f.live = { ...f.live, state: 'REVOKED', revision: 2 };
  assert.equal((await deliver('service.access.revoked', f.live, 'e2')).revision, 2);
  assert.equal((await f.service.effective(base)).plan, 'FREE');
  assert.equal(paid, 0);
  const p = { event: 'service.access.provisional', timestamp: Date.now(), data: f.live };
  await assert.rejects(
    c.handleWebhook('sha256=bad', String(p.timestamp), {
      body: p,
      rawBody: Buffer.from(JSON.stringify(p)),
    }),
    (e) => e.getStatus() === 401,
  );
});
test('yearly checkout retains365day period and revoked grants survive consumer restart', async () => {
  const f = fixture();
  const p = {
    paymentSession: {
      findUnique: async () => ({
        sessionId: 's1',
        provider: 'feefree',
        orderId: 'o1',
        currency: 'INR',
        amountPaise: 354,
        baseAmountPaise: 354,
        plan: 'PRO',
        cycle: 'YEARLY',
        userId: 'u1',
      }),
    },
    systemSetting: {
      findUnique: async ({ where }) => f.rows.get(where.key),
      create: async ({ data }) => f.rows.set(data.key, data),
      updateMany: async ({ where, data }) => {
        const row = f.rows.get(where.key);
        if (row.value !== where.value) return { count: 0 };
        f.rows.set(where.key, { ...row, ...data });
        return { count: 1 };
      },
      findMany: async () =>
        [...f.rows.values()].filter((r) => r.key.startsWith('feefree_service_grant:')),
    },
  };
  p.$transaction = async (fn) => fn(p);
  const fresh = () => new ServiceAccessService(p, f.provider, { get: () => 'true' });
  await fresh().accept('service.access.provisional', 'year1', f.live);
  const row = JSON.parse(f.rows.get('feefree_service_grant:g1').value);
  assert.equal(Date.parse(row.periodEnd) - Date.parse(row.grant.issuedAt), 365 * 86400000);
  f.live = { ...f.live, state: 'REVOKED', revision: 2 };
  await fresh().accept('service.access.revoked', 'year2', f.live);
  await fresh().accept('service.access.provisional', 'delayed', original());
  assert.equal((await fresh().effective({ userId: 'u1', plan: 'FREE' })).plan, 'FREE');
});
test('real Nest HTTP/global interceptor returns direct exact service ACK,not browser response wrapper', async () => {
  const { NestFactory } = require('../../apps/api/node_modules/@nestjs/core');
  const { Module } = require('../../apps/api/node_modules/@nestjs/common');
  const { ConfigService } = require('../../apps/api/dist/config/config.service');
  const { SubscriptionService } = require('../../apps/api/dist/billing/subscription.service');
  const {
    FeeFreeWebhookController,
  } = require('../../apps/api/dist/billing/feefree-webhook.controller');
  const {
    ResponseInterceptor,
  } = require('../../apps/api/dist/common/interceptors/response.interceptor');
  const f = fixture();
  class HarnessModule {}
  Module({
    controllers: [FeeFreeWebhookController],
    providers: [
      {
        provide: SubscriptionService,
        useValue: {
          fulfillFeeFreePayment: () => {
            throw Error('paid lane');
          },
        },
      },
      { provide: ConfigService, useValue: { get: () => 'synthetic-http-secret' } },
      { provide: ServiceAccessService, useValue: f.service },
    ],
  })(HarnessModule);
  const app = await NestFactory.create(HarnessModule, {
    logger: false,
    rawBody: true,
    abortOnError: false,
  });
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(0, '127.0.0.1');
  try {
    const timestamp = Date.now(),
      event = 'service.access.provisional',
      eventId = 'http-exact';
    const body = JSON.stringify({
        event,
        timestamp,
        data: { ...f.live, event, eventId, timestamp: new Date().toISOString() },
      }),
      sig = require('node:crypto')
        .createHmac('sha256', 'synthetic-http-secret')
        .update(body)
        .digest('hex');
    const r = await fetch((await app.getUrl()) + '/billing/webhook/feefree', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FeeFree-Signature': 'sha256=' + sig,
        'X-FeeFree-Timestamp': String(timestamp),
      },
      body,
    });
    assert.equal(r.status, 201);
    assert.deepEqual(await r.json(), { handled: true, eventId, grantId: 'g1', revision: 1 });
  } finally {
    await app.close();
  }
});
