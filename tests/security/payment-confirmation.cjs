const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { SubscriptionService } = require('../../apps/api/dist/billing/subscription.service');
const {
  FeeFreeWebhookController,
} = require('../../apps/api/dist/billing/feefree-webhook.controller');
const crypto = require('node:crypto');
function fixture() {
  const data = {
    eventId: 'evt1',
    merchantId: 'merchant1',
    sessionId: 'session1',
    orderId: 'order1',
    amountPaise: 3540,
    baseAmountPaise: 3540,
    discountPaise: 0,
    currency: 'INR',
    utr: '123456789012',
    completedAt: new Date().toISOString(),
    confirmationSource: 'HDFC_EMAIL',
    bankVerified: false,
    senderAuthenticated: false,
  };
  let payment = {
    sessionId: 'session1',
    provider: 'feefree',
    orderId: 'order1',
    amountPaise: 3540,
    baseAmountPaise: 3540,
    currency: 'INR',
    invoiceId: 'invoice1',
    userId: 'user1',
    plan: 'PRO',
    cycle: 'YEARLY',
    status: 'PENDING',
    utr: null,
  };
  let invoice = { id: 'invoice1', userId: 'user1', amount: 30, status: 'PENDING' };
  let base = { userId: 'user1', plan: 'FREE', status: 'ACTIVE', expiresAt: null };
  let grants = [];
  const records = new Map();
  let writes = 0;
  let live = { ...data, event: 'payment.confirmed', status: 'SUCCESS' };
  const prisma = {
    paymentSession: {
      findUnique: async () => payment,
      findMany: async () => [payment],
      updateMany: async ({ where, data: d }) => {
        assert.equal(where.status, payment.status);
        assert.equal(where.utr, payment.utr);
        payment = { ...payment, ...d };
        writes++;
        return { count: 1 };
      },
    },
    invoice: {
      findFirst: async ({ where }) =>
        where.paymentId
          ? invoice.paymentId === where.paymentId
            ? invoice
            : null
          : where.userId === invoice.userId
            ? invoice
            : null,
      findMany: async () => [invoice],
      update: async ({ data: d }) => {
        invoice = { ...invoice, ...d };
        writes++;
      },
    },
    systemSetting: {
      findUnique: async ({ where }) =>
        records.has(where.key) ? { value: records.get(where.key) } : null,
      findMany: async () => grants,
      create: async ({ data: d }) => {
        assert(!records.has(d.key));
        records.set(d.key, d.value);
        writes++;
      },
    },
    subscription: {
      findUnique: async () => base,
      upsert: async ({ update }) => {
        base = { ...base, ...update };
        writes++;
      },
    },
  };
  prisma.$transaction = async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    const before = {
      payment: { ...payment },
      invoice: { ...invoice },
      base: { ...base },
      records: new Map(records),
      writes,
    };
    try {
      return await fn(prisma);
    } catch (e) {
      payment = before.payment;
      invoice = before.invoice;
      base = before.base;
      records.clear();
      for (const [k, v] of before.records) records.set(k, v);
      writes = before.writes;
      throw e;
    }
  };
  const service = new SubscriptionService(
    prisma,
    {},
    { getPaymentConfirmation: async () => live },
    {},
  );
  return {
    data,
    service,
    prisma,
    records,
    get payment() {
      return payment;
    },
    get invoice() {
      return invoice;
    },
    get base() {
      return base;
    },
    get writes() {
      return writes;
    },
    set grants(v) {
      grants = v;
    },
    set live(v) {
      live = v;
    },
    set base(v) {
      base = v;
    },
  };
}
test('confirmation atomically marks exact amount and activates once, stable ACK/reordered replay', async () => {
  const f = fixture();
  const ack = await f.service.confirmFeeFreePayment(f.data);
  assert.deepEqual(ack, {
    handled: true,
    eventId: 'evt1',
    sessionId: 'session1',
    orderId: 'order1',
  });
  assert.equal(f.invoice.amount, 35.4);
  assert.equal(f.invoice.status, 'PAID');
  assert.equal(f.payment.utr, f.data.utr);
  assert.equal(f.base.plan, 'PRO');
  const expiry = f.base.expiresAt.getTime(),
    writes = f.writes;
  await f.service.confirmFeeFreePayment(Object.fromEntries(Object.entries(f.data).reverse()));
  assert.equal(f.writes, writes);
  assert.equal(f.base.expiresAt.getTime(), expiry);
  const audit = JSON.parse([...f.records.values()][0]);
  assert.equal(audit.bankVerified, false);
  assert.equal(audit.senderAuthenticated, false);
  assert.equal(audit.confirmationSource, 'HDFC_EMAIL');
});
test('confirmation rejects mismatched IDs/amount/source/status without effects', async () => {
  for (const patch of [
    { amountPaise: 3500 },
    { orderId: 'other' },
    { currency: 'USD' },
    { bankVerified: true },
    { senderAuthenticated: true },
    { confirmationSource: 'OTHER' },
    { eventId: '' },
    { completedAt: 'bad' },
  ]) {
    const f = fixture();
    await assert.rejects(f.service.confirmFeeFreePayment({ ...f.data, ...patch }));
    assert.equal(f.writes, 0);
  }
  for (const patch of [
    { merchantId: 'other' },
    { utr: 'other' },
    { status: 'PENDING' },
    { eventId: 'other' },
    { sessionId: 'other' },
  ]) {
    const f = fixture();
    f.live = { ...f.data, event: 'payment.confirmed', status: 'SUCCESS', ...patch };
    await assert.rejects(f.service.confirmFeeFreePayment(f.data));
    assert.equal(f.writes, 0);
  }
});
test('same checkout legacy grant preserves period, revoked grant blocks atomically', async () => {
  for (const state of ['PROVISIONAL', 'REVOKED']) {
    const f = fixture(),
      end = new Date(Date.now() + 100000000).toISOString();
    f.grants = [
      {
        value: JSON.stringify({
          userId: 'user1',
          grant: { sessionId: 'session1', state },
          periodEnd: end,
        }),
      },
    ];
    if (state === 'REVOKED') {
      await assert.rejects(f.service.confirmFeeFreePayment(f.data));
      assert.equal(f.invoice.status, 'PENDING');
      assert.equal(f.writes, 0);
    } else {
      await f.service.confirmFeeFreePayment(f.data);
      assert.equal(f.base.expiresAt.toISOString(), end);
    }
  }
});
test('later or higher paid access remains unchanged', async () => {
  const f = fixture();
  const end = new Date(Date.now() + 900 * 86400000);
  f.base = { userId: 'user1', plan: 'ENTERPRISE', status: 'ACTIVE', expiresAt: end };
  await f.service.confirmFeeFreePayment(f.data);
  assert.equal(f.base.plan, 'ENTERPRISE');
  assert.equal(f.base.expiresAt, end);
  assert.equal(f.invoice.status, 'PAID');
});
test('historical invoice display uses owner-scoped exact stored payable without status mutation', async () => {
  const f = fixture();
  const inv = await f.service.getInvoices('user1');
  assert.equal(inv[0].amount, 35.4);
  assert.equal(inv[0].status, 'PENDING');
  assert.equal(f.invoice.amount, 30);
  assert.equal(f.writes, 0);
});
test('new FeeFree invoice stores tax-inclusive exact discounted provider payable, no enrollment', async () => {
  let amount, session;
  const service = new SubscriptionService(
    {
      invoice: {
        create: async ({ data }) => {
          amount = data.amount;
          return { id: '12345678-1234-1234-1234-123456789012' };
        },
        update: async ({ data }) => {
          amount = data.amount;
        },
      },
      paymentSession: {
        create: async ({ data }) => {
          session = data;
        },
      },
    },
    {},
    {
      createSession: async () => ({
        id: 's',
        expectedAmountPaise: 3539,
        checkoutUrl: 'https://example.invalid',
      }),
    },
    {},
    {
      enabled: () => true,
      enroll: async () => {
        throw Error('must not enroll');
      },
    },
  );
  await service.createFeeFreeCheckout(
    'u',
    {},
    'PRO',
    'YEARLY',
    30,
    3540,
    undefined,
    'https://www.dmpilot.org',
  );
  assert.equal(amount, 35.39);
  assert.equal(session.amountPaise, 3539);
  assert.equal(session.baseAmountPaise, 3540);
});
test('webhook confirmation requires valid HMAC and freshness', async () => {
  let received = 0;
  const controller = new FeeFreeWebhookController(
    {
      confirmFeeFreePayment: async () => {
        received++;
        return { handled: true };
      },
    },
    { get: () => 'test-secret' },
    {},
  );
  const payload = { event: 'payment.confirmed', timestamp: Date.now(), data: { eventId: 'e' } };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');
  await controller.handleWebhook(sig, String(payload.timestamp), { body: payload, rawBody: raw });
  assert.equal(received, 1);
  await assert.rejects(
    controller.handleWebhook('wrong', String(payload.timestamp), { body: payload, rawBody: raw }),
  );
  payload.timestamp -= 600000;
  const stale = JSON.stringify(payload);
  await assert.rejects(
    controller.handleWebhook(
      crypto.createHmac('sha256', 'test-secret').update(stale).digest('hex'),
      String(payload.timestamp),
      { body: payload, rawBody: stale },
    ),
  );
  assert.equal(received, 1);
});
