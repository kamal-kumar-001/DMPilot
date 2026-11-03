/* eslint-disable @typescript-eslint/no-var-requires */
// Isolated regression harness for DMPilot billing webhooks (FeeFree + Razorpay).
// Runs the REAL compiled controllers/services from apps/api/dist against an
// in-memory Prisma mock. No network, no DB, no live payments.
const crypto = require('crypto');
const path = require('path');
const API = process.env.DMPILOT_API_ROOT || require('path').join(__dirname, '..', 'apps', 'api');
const { FeeFreeWebhookController } = require(
  path.join(API, 'dist/billing/feefree-webhook.controller.js'),
);
const { RazorpayWebhookController } = require(
  path.join(API, 'dist/billing/razorpay-webhook.controller.js'),
);
const { SubscriptionService } = require(path.join(API, 'dist/billing/subscription.service.js'));

const FF_SECRET = 'whsec_test_123';
const RZP_SECRET = 'rzpsec_test_123';

function makeConfig(map) {
  return { get: (k) => map[k] };
}

function makeDb() {
  return {
    sessions: new Map(), // sessionId -> record
    invoices: [], // invoice records
    subs: new Map(), // userId -> subscription
    audit: [],
    seq: 0,
  };
}

function makePrisma(db) {
  return {
    paymentSession: {
      findUnique: async ({ where: { sessionId } }) => db.sessions.get(sessionId) || null,
      findFirst: async ({ where }) => {
        for (const s of db.sessions.values()) {
          if (s.utr && s.utr === where.utr && s.id !== where.id.not) return s;
        }
        return null;
      },
      update: async ({ where: { id }, data }) => {
        for (const [k, s] of db.sessions) {
          if (s.id === id) {
            // enforce the real unique index on paymentSession.utr
            if (data.utr) {
              for (const [k2, o] of db.sessions) {
                if (o.id !== id && o.utr === data.utr) {
                  const e = new Error('Unique constraint failed on the fields: (`utr`)');
                  e.code = 'P2002';
                  throw e;
                }
              }
            }
            Object.assign(s, data);
            return s;
          }
        }
        throw new Error('session not found');
      },
    },
    invoice: {
      findFirst: async ({ where }) =>
        db.invoices.find((i) => where.paymentId && i.paymentId === where.paymentId) || null,
      findMany: async () => db.invoices,
      create: async ({ data }) => {
        const r = { id: `inv_${++db.seq}`, ...data };
        db.invoices.push(r);
        return r;
      },
      update: async ({ where: { id }, data }) => {
        const inv = db.invoices.find((i) => i.id === id);
        if (!inv) throw new Error('invoice not found');
        Object.assign(inv, data);
        return inv;
      },
    },
    subscription: {
      findUnique: async ({ where: { userId } }) => db.subs.get(userId) || null,
      upsert: async ({ where: { userId }, create, update }) => {
        if (db.subs.has(userId)) {
          Object.assign(db.subs.get(userId), update);
          return db.subs.get(userId);
        }
        const r = { id: `sub_${++db.seq}`, ...create };
        db.subs.set(userId, r);
        return r;
      },
    },
    billingPlan: { findUnique: async () => null },
    auditLog: {
      create: async ({ data }) => {
        db.audit.push(data);
        return data;
      },
    },
  };
}

function ffSign(body) {
  return 'sha256=' + crypto.createHmac('sha256', FF_SECRET).update(body).digest('hex');
}
function rzpSign(body) {
  return crypto.createHmac('sha256', RZP_SECRET).update(body).digest('hex');
}

function ffReq(payload) {
  const raw = JSON.stringify(payload);
  return { req: { rawBody: raw, body: payload }, sig: ffSign(raw), ts: String(payload.timestamp) };
}

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

function seedPaidFlowState(db) {
  db.sessions.set('ffsess_1', {
    id: 'psrow_1',
    sessionId: 'ffsess_1',
    orderId: 'inv_order_1',
    userId: 'user_1',
    plan: 'PRO',
    cycle: 'MONTHLY',
    amountPaise: 117822,
    baseAmountPaise: 99900,
    currency: 'INR',
    status: 'PENDING',
    utr: null,
    invoiceId: 'inv_pre_1',
    billingDetails: null,
  });
  db.invoices.push({
    id: 'inv_pre_1',
    userId: 'user_1',
    amount: 1178.22,
    currency: 'INR',
    plan: 'PRO',
    cycle: 'MONTHLY',
    status: 'PENDING',
    paymentId: null,
    paymentLinkId: null,
  });
}

function ffPayload(over = {}) {
  return {
    event: 'payment.success',
    timestamp: Date.now(),
    data: {
      orderId: 'inv_order_1',
      sessionId: 'ffsess_1',
      amountPaise: 117822,
      baseAmountPaise: 99900,
      discountPaise: 0,
      utr: 'UTR000111',
      verificationTier: 'SMS_OBSERVED',
      completedAt: new Date().toISOString(),
      ...over,
    },
  };
}

function makeStack(db, feefreeLive) {
  const prisma = makePrisma(db);
  const cfg = makeConfig({
    FEEFREE_WEBHOOK_SECRET: FF_SECRET,
    RAZORPAY_WEBHOOK_SECRET: RZP_SECRET,
  });
  const ffService = { getSession: feefreeLive };
  const subSvc = new SubscriptionService(prisma, cfg, ffService);
  const ffCtl = new FeeFreeWebhookController(subSvc, cfg);
  const rzpCtl = new RazorpayWebhookController(subSvc, cfg);
  return { prisma, subSvc, ffCtl, rzpCtl };
}

(async () => {
  // ---------------- FeeFree webhook crypto + fulfillment ----------------
  await test('FF: missing signature rejected', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({ status: 'SUCCESS' }));
    const { req, ts } = ffReq(ffPayload());
    await expectReject(
      () => ffCtl.handleWebhook(undefined, ts, req),
      /Missing x-feefree-signature/,
      'expected 401',
    );
  });

  await test('FF: invalid signature rejected, no state change', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({ status: 'SUCCESS' }));
    const { req, ts } = ffReq(ffPayload());
    await expectReject(
      () => ffCtl.handleWebhook('sha256=deadbeef', ts, req),
      /Invalid webhook signature/,
      'expected 401',
    );
    expect(db.sessions.get('ffsess_1').status === 'PENDING', 'session must stay PENDING');
  });

  await test('FF: valid signed fresh webhook upgrades exactly once', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR000111',
    }));
    const { req, sig, ts } = ffReq(ffPayload());
    const r = await ffCtl.handleWebhook(sig, ts, req);
    expect(r.received === true && r.orderId === 'inv_order_1', 'expected receipt');
    expect(db.sessions.get('ffsess_1').status === 'PAID', 'session must be PAID');
    expect(db.sessions.get('ffsess_1').utr === 'UTR000111', 'session must store UTR');
    expect(
      db.invoices.find((i) => i.id === 'inv_pre_1').status === 'PAID',
      'pre-created invoice must be PAID',
    );
    expect(db.subs.get('user_1').plan === 'PRO', 'subscription must be PRO');
  });

  await test('FF: replay of identical webhook dedupes, no double upgrade', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR000111',
    }));
    const { req, sig, ts } = ffReq(ffPayload());
    await ffCtl.handleWebhook(sig, ts, req);
    const invCount = db.invoices.length;
    const r2 = await ffCtl.handleWebhook(sig, ts, req);
    expect(r2.deduped === true, 'second delivery must be deduped');
    expect(db.invoices.length === invCount, 'no new invoice');
    expect(
      db.invoices.filter((i) => i.paymentId === 'UTR000111').length === 1,
      'exactly one invoice carries the UTR',
    );
  });

  await test('FF: stale signed timestamp rejected (attacker cannot refresh it)', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR000111',
    }));
    const payload = ffPayload();
    payload.timestamp = Date.now() - 60 * 60 * 1000; // 1h old, still validly signed
    const { req, sig } = ffReq(payload);
    await expectReject(
      () => ffCtl.handleWebhook(sig, String(Date.now()), req),
      /Stale or invalid webhook timestamp/,
      'expected 401',
    );
    expect(db.sessions.get('ffsess_1').status === 'PENDING', 'session must stay PENDING');
  });

  await test('FF: header/body timestamp mismatch rejected', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR000111',
    }));
    const { req, sig } = ffReq(ffPayload());
    await expectReject(
      () => ffCtl.handleWebhook(sig, String(Date.now() - 1000), req),
      /does not match signed payload/,
      'expected 401',
    );
  });

  await test('FF: amount mismatch vs stored session rejected', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR000111',
    }));
    const { req, sig, ts } = ffReq(ffPayload({ amountPaise: 100 }));
    await expectReject(() => ffCtl.handleWebhook(sig, ts, req), /Amount mismatch/, 'expected 400');
    expect(db.sessions.get('ffsess_1').status === 'PENDING', 'session must stay PENDING');
  });

  await test('FF: unknown session/order binding rejected', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({ status: 'SUCCESS' }));
    const { req, sig, ts } = ffReq(ffPayload({ orderId: 'inv_order_999' }));
    await expectReject(
      () => ffCtl.handleWebhook(sig, ts, req),
      /Unknown FeeFree checkout session/,
      'expected 404',
    );
  });

  await test('FF: same UTR on a second session is deduped', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    db.sessions.set('ffsess_2', {
      id: 'psrow_2',
      sessionId: 'ffsess_2',
      orderId: 'inv_order_2',
      userId: 'user_2',
      plan: 'PRO',
      cycle: 'MONTHLY',
      amountPaise: 117822,
      baseAmountPaise: 99900,
      currency: 'INR',
      status: 'PENDING',
      utr: null,
      invoiceId: null,
      billingDetails: null,
    });
    const { ffCtl } = makeStack(db, async (id) => ({
      status: 'SUCCESS',
      orderId: id === 'ffsess_1' ? 'inv_order_1' : 'inv_order_2',
      utr: 'UTR000111',
    }));
    const p1 = ffPayload();
    const r1 = ffReq(p1);
    await ffCtl.handleWebhook(r1.sig, r1.ts, r1.req);
    const p2 = ffPayload({ sessionId: 'ffsess_2', orderId: 'inv_order_2' });
    const r2 = ffReq(p2);
    const res = await ffCtl.handleWebhook(r2.sig, r2.ts, r2.req);
    expect(res.deduped === true, 'UTR clash must dedupe');
    expect(db.sessions.get('ffsess_2').status === 'PENDING', 'second session must NOT be paid');
    expect(db.subs.has('user_2') === false, 'user_2 must not be upgraded');
  });

  await test('FF: live re-confirmation failure rejected (signed webhook alone grants nothing)', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({ status: 'PENDING' }));
    const { req, sig, ts } = ffReq(ffPayload());
    await expectReject(
      () => ffCtl.handleWebhook(sig, ts, req),
      /not confirmed as paid/,
      'expected 400',
    );
    expect(db.sessions.get('ffsess_1').status === 'PENDING', 'session must stay PENDING');
  });

  await test('FF: live re-confirmation UTR mismatch rejected', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR999999',
    }));
    const { req, sig, ts } = ffReq(ffPayload());
    await expectReject(() => ffCtl.handleWebhook(sig, ts, req), /UTR mismatch/, 'expected 400');
  });

  await test('FF: concurrent duplicate webhooks settle to one paid state', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({
      status: 'SUCCESS',
      orderId: 'inv_order_1',
      utr: 'UTR000111',
    }));
    const { req, sig, ts } = ffReq(ffPayload());
    const [a, b] = await Promise.allSettled([
      ffCtl.handleWebhook(sig, ts, req),
      ffCtl.handleWebhook(sig, ts, req),
    ]);
    expect(db.sessions.get('ffsess_1').status === 'PAID', 'session PAID');
    expect(
      db.invoices.filter((i) => i.paymentId === 'UTR000111').length === 1,
      'exactly one paid invoice for UTR',
    );
    expect(db.subs.get('user_1').plan === 'PRO', 'subscription PRO');
    const rejected = [a, b].filter((r) => r.status === 'rejected');
    if (rejected.length)
      console.log(
        `   note: ${rejected.length} concurrent call(s) rejected safely: ${rejected[0].reason.message}`,
      );
  });

  await test('FF: concurrent same-UTR different-session -> unique index blocks the loser', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    db.sessions.set('ffsess_2', {
      id: 'psrow_2',
      sessionId: 'ffsess_2',
      orderId: 'inv_order_2',
      userId: 'user_2',
      plan: 'PRO',
      cycle: 'MONTHLY',
      amountPaise: 117822,
      baseAmountPaise: 99900,
      currency: 'INR',
      status: 'PENDING',
      utr: null,
      invoiceId: null,
      billingDetails: null,
    });
    const { ffCtl } = makeStack(db, async (id) => ({
      status: 'SUCCESS',
      orderId: id === 'ffsess_1' ? 'inv_order_1' : 'inv_order_2',
      utr: 'UTR000111',
    }));
    const r1 = ffReq(ffPayload());
    const r2 = ffReq(ffPayload({ sessionId: 'ffsess_2', orderId: 'inv_order_2' }));
    const [a, b] = await Promise.allSettled([
      ffCtl.handleWebhook(r1.sig, r1.ts, r1.req),
      ffCtl.handleWebhook(r2.sig, r2.ts, r2.req),
    ]);
    const okCount = [a, b].filter((r) => r.status === 'fulfilled' && !r.value.deduped).length;
    expect(okCount <= 1, 'at most one session fulfilled');
    expect(
      (db.sessions.get('ffsess_1').status === 'PAID') !==
        (db.sessions.get('ffsess_2').status === 'PAID'),
      'exactly one session PAID, never both',
    );
  });

  await test('FF: non-payment events acknowledged without state change', async () => {
    const db = makeDb();
    seedPaidFlowState(db);
    const { ffCtl } = makeStack(db, async () => ({ status: 'SUCCESS' }));
    const { req, sig, ts } = ffReq({ event: 'session.expired', timestamp: Date.now(), data: {} });
    const r = await ffCtl.handleWebhook(sig, ts, req);
    expect(r.received === true && r.handled === false, 'acknowledged only');
  });

  // ---------------- Razorpay webhook ----------------
  function rzpEvent(over = {}) {
    return {
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: {
            id: 'plink_1',
            amount: 117822,
            currency: 'INR',
            notes: { userId: 'user_9', plan: 'PRO', cycle: 'MONTHLY', billingDetails: '' },
          },
        },
        payment: {
          entity: {
            id: 'pay_1',
            amount: 117822,
            currency: 'INR',
            payment_link_id: 'plink_1',
            status: 'captured',
            ...over,
          },
        },
      },
    };
  }
  function rzpReq(event) {
    const raw = JSON.stringify(event);
    return { req: { rawBody: raw, body: event }, sig: rzpSign(raw) };
  }

  await test('RZP: valid exact-amount linked payment upgrades', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const { req, sig } = rzpReq(rzpEvent());
    await rzpCtl.handleWebhook(sig, req);
    expect(db.subs.get('user_9').plan === 'PRO', 'subscription PRO');
    expect(
      db.invoices.some((i) => i.paymentId === 'pay_1' && i.status === 'PAID'),
      'paid invoice recorded',
    );
  });

  await test('RZP: OVERPAYMENT rejected (exact match required, accept_partial=false)', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const { req, sig } = rzpReq(rzpEvent({ amount: 117823 }));
    await expectReject(
      () => rzpCtl.handleWebhook(sig, req),
      /amount or currency mismatch/i,
      'expected 400',
    );
    expect(!db.subs.has('user_9'), 'no upgrade');
  });

  await test('RZP: underpayment rejected', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const { req, sig } = rzpReq(rzpEvent({ amount: 100 }));
    await expectReject(
      () => rzpCtl.handleWebhook(sig, req),
      /amount or currency mismatch/i,
      'expected 400',
    );
  });

  await test('RZP: payment not bound to the link rejected', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const { req, sig } = rzpReq(rzpEvent({ payment_link_id: 'plink_OTHER' }));
    await expectReject(
      () => rzpCtl.handleWebhook(sig, req),
      /not bound to this payment link/,
      'expected 400',
    );
    expect(!db.subs.has('user_9'), 'no upgrade');
  });

  await test('RZP: bad signature rejected', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const { req } = rzpReq(rzpEvent());
    await expectReject(
      () => rzpCtl.handleWebhook('badbad', req),
      /Invalid signature/,
      'expected 400',
    );
  });

  await test('RZP: refund.processed audited, no plan change', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const paid = rzpEvent();
    const r1 = rzpReq(paid);
    await rzpCtl.handleWebhook(r1.sig, r1.req);
    const refund = {
      event: 'refund.processed',
      payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 117822 } } },
    };
    const r2 = rzpReq(refund);
    await rzpCtl.handleWebhook(r2.sig, r2.req);
    expect(
      db.audit.some((a) => a.action === 'PAYMENT_REFUNDED' && a.userId === 'user_9'),
      'refund audit logged with user',
    );
    expect(db.subs.get('user_9').plan === 'PRO', 'plan NOT auto-downgraded');
  });

  await test('RZP: payment.failed audited', async () => {
    const db = makeDb();
    const { rzpCtl } = makeStack(db, async () => ({}));
    const failed = {
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_x', amount: 117822 } } },
    };
    const { req, sig } = rzpReq(failed);
    await rzpCtl.handleWebhook(sig, req);
    expect(
      db.audit.some((a) => a.action === 'PAYMENT_FAILED'),
      'failure audit logged',
    );
  });

  console.log('\n===== RESULTS =====');
  for (const r of results) console.log(r);
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
