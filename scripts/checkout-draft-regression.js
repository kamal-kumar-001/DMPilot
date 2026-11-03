/* eslint-disable @typescript-eslint/no-var-requires */
// Isolated checks for the checkout form draft. Real lib/checkout-draft.ts, fake browser storage.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require(
  require.resolve('typescript', { paths: [path.join(__dirname, '..', 'apps', 'web'), __dirname] }),
);
const src = fs.readFileSync(path.join(__dirname, '..', 'apps/web/lib/checkout-draft.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: 'commonjs', target: 'es2019' },
}).outputText;
const store = {};
global.window = {
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  },
};
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const L = m.exports;
const results = [];
const test = (n, f) => {
  try {
    f();
    results.push('PASS  ' + n);
  } catch (e) {
    results.push('FAIL  ' + n + ' :: ' + e.message);
  }
};
const form = (o = {}) => ({
  name: 'A',
  email: 'a@x.test',
  phone: '99',
  address: 'St 1',
  city: 'C',
  state: 'S',
  pincode: '1',
  country: 'India',
  gstin: '',
  acceptConsent: true,
  ...o,
});
const reset = () => Object.keys(store).forEach((k) => delete store[k]);
const NOW = Date.now();
const inv = (o) => ({
  id: 'i2',
  plan: 'PRO',
  cycle: 'YEARLY',
  status: 'PAID',
  createdAt: new Date(NOW + 1000).toISOString(),
  ...o,
});
const pend = (o = {}) => ({
  plan: 'PRO',
  cycle: 'YEARLY',
  startedAt: NOW,
  baselineInvoiceIds: ['i1'],
  checkoutRef: 'i2',
  ...o,
});

test('refresh keeps the form (save then load)', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  assert.strictEqual(L.loadCheckoutDraft('u1').phone, '99');
});
test('drafts are isolated per account', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  assert.strictEqual(L.loadCheckoutDraft('u2'), null);
});
test('only form fields are stored (no secrets)', () => {
  reset();
  L.saveCheckoutDraft('u1', { ...form(), password: 'x', card: '4111' });
  const raw = store['dmpilot:checkout-draft:v1:u1'];
  assert.ok(!/password|card|4111/.test(raw));
});
test('already-paid user with a pending renewal keeps the draft (no new invoice)', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend());
  assert.strictEqual(
    L.clearDraftIfVerified('u1', [
      {
        id: 'i1',
        plan: 'PRO',
        cycle: 'YEARLY',
        status: 'PAID',
        createdAt: new Date(NOW - 86400000).toISOString(),
      },
    ]),
    false,
  );
  assert.ok(L.loadCheckoutDraft('u1'));
});
test('forged success URL does nothing: no pending marker, no invoice, draft stays', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  assert.strictEqual(L.clearDraftIfVerified('u1', []), false);
  assert.ok(L.loadCheckoutDraft('u1'));
});
test('failed or pending payment (no new paid invoice) keeps the draft', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend());
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv({ status: 'FAILED' })]), false);
  assert.strictEqual(L.clearDraftIfVerified('u1', []), false);
  assert.ok(L.loadCheckoutDraft('u1'));
});
test('new paid invoice for another plan or cycle does not clear', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend());
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv({ plan: 'ENTERPRISE' })]), false);
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv({ cycle: 'MONTHLY' })]), false);
});
test('current verified completion clears draft and marker', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend());
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv()]), true);
  assert.strictEqual(L.loadCheckoutDraft('u1'), null);
  assert.strictEqual(L.readCheckoutPending('u1'), null);
});
test('another account verified payment does not clear this account', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.saveCheckoutDraft('u2', form({ name: 'B' }));
  L.markCheckoutPending('u2', pend());
  L.clearDraftIfVerified('u2', [inv()]);
  assert.ok(L.loadCheckoutDraft('u1'));
  assert.strictEqual(L.loadCheckoutDraft('u2'), null);
});
test('stale pending marker (over 24h) is ignored', () => {
  reset();
  L.markCheckoutPending('u1', pend({ startedAt: NOW - 25 * 3600 * 1000 }));
  assert.strictEqual(L.readCheckoutPending('u1'), null);
});
test('exact ref: unrelated concurrent paid invoice (same plan+cycle) does not clear', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend({ checkoutRef: 'plink_A' }));
  assert.strictEqual(
    L.clearDraftIfVerified('u1', [inv({ id: 'iX', paymentLinkId: 'plink_B' })]),
    false,
  );
  assert.ok(L.loadCheckoutDraft('u1'));
});
test('exact ref: razorpay invoice with matching payment link clears', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend({ checkoutRef: 'plink_A' }));
  assert.strictEqual(
    L.clearDraftIfVerified('u1', [inv({ id: 'iY', paymentLinkId: 'plink_A' })]),
    true,
  );
});
test('exact ref: UPI invoice that was PENDING at start clears only once PAID', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending(
    'u1',
    pend({ baselineInvoiceIds: ['i1', 'inv_up'], checkoutRef: 'inv_up' }),
  );
  assert.strictEqual(
    L.clearDraftIfVerified('u1', [inv({ id: 'inv_up', status: 'PENDING' })]),
    false,
  );
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv({ id: 'inv_up' })]), true);
});
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);

test('no server ref: never clears (no plan/time guessing)', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend({ checkoutRef: undefined }));
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv()]), false);
  assert.notStrictEqual(L.loadCheckoutDraft('u1'), null);
});
test('promo-100 style: ref is the server invoice id, clears only on that PAID invoice', () => {
  reset();
  L.saveCheckoutDraft('u1', form());
  L.markCheckoutPending('u1', pend({ checkoutRef: 'inv_promo' }));
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv({ id: 'other' })]), false);
  assert.strictEqual(L.clearDraftIfVerified('u1', [inv({ id: 'inv_promo' })]), true);
});
