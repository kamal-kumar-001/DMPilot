/* eslint-disable @typescript-eslint/no-var-requires */
// Isolated checks: pricing matrix labels always name their unit; mail sender env aliases work.
// No network, no DB.
const path = require('path');
const API = path.join(__dirname, '..', 'apps', 'api');
const { AppController } = require(path.join(API, 'dist/app.controller.js'));
const { MailService } = require(path.join(API, 'dist/mail/mail.service.js'));
const assert = require('assert');
const results = [];
async function test(n, fn) {
  try {
    await fn();
    results.push('PASS  ' + n);
  } catch (e) {
    results.push('FAIL  ' + n + ' :: ' + e.message);
  }
}
const plan = (key, c, k, d, a) => ({
  key,
  name: key,
  priceMonthly: 0,
  priceYearly: 0,
  campaignLimit: c,
  keywordLimit: k,
  dmLimitMonthly: d,
  accountLimit: a,
});
async function matrix(plans) {
  const prisma = {
    billingPlan: { findMany: async () => plans },
    systemSetting: { findMany: async () => [] },
    featureFlag: { findMany: async () => [] },
  };
  const res = await new AppController(prisma).getPricingPromo();
  const core = res.comparisonMatrix.find((c) => c.category === 'Core Capabilities').features;
  const acct = res.comparisonMatrix.find((c) => c.category === 'Account & Management').features;
  return { res, row: (n) => [...core, ...acct].find((f) => f.name === n) };
}
(async () => {
  await test('unlimited values name what is unlimited', async () => {
    const m = await matrix([
      plan('FREE', -1, -1, -1, -1),
      plan('PRO', -1, -1, -1, -1),
      plan('ENTERPRISE', -1, -1, -1, -1),
    ]);
    assert.strictEqual(m.row('Active Automation Campaigns').pro, 'Unlimited campaigns');
    assert.strictEqual(m.row('Monthly DM Volume').pro, 'Unlimited DMs per month');
    assert.strictEqual(m.row('Keywords Per Campaign').pro, 'Unlimited keywords per campaign');
    assert.strictEqual(m.row('Connected Instagram Accounts').pro, 'Unlimited Instagram accounts');
  });
  await test('finite Free limits show numbers with units, from the plan row', async () => {
    const m = await matrix([
      plan('FREE', 2, 5, 1000, 1),
      plan('PRO', -1, -1, -1, 3),
      plan('ENTERPRISE', -1, -1, -1, -1),
    ]);
    assert.strictEqual(m.row('Active Automation Campaigns').free, '2 Campaigns');
    assert.strictEqual(m.row('Monthly DM Volume').free, '1,000 DMs per month');
    assert.strictEqual(m.row('Keywords Per Campaign').free, '5 Keywords per campaign');
    assert.strictEqual(m.row('Connected Instagram Accounts').free, '1 Instagram account');
    assert.strictEqual(m.row('Connected Instagram Accounts').pro, '3 Instagram accounts');
    assert.strictEqual(m.res.plans.find((p) => p.key === 'FREE').accountLimit, 1);
  });
  await test('mail sender aliases (no-reply / receipts) are honoured, no secrets involved', async () => {
    const cfg = {
      get: (k) =>
        ({ SMTP_FROM_NO_REPLY: 'A <no-reply@x.test>', SMTP_FROM_RECEIPTS: 'B <receipts@x.test>' })[
          k
        ],
    };
    const svc = new MailService(cfg, { setContext() {}, log() {}, warn() {}, error() {} });
    assert.strictEqual(svc.resolveFromAddress('noreply'), 'A <no-reply@x.test>');
    assert.strictEqual(svc.resolveFromAddress('receipts'), 'B <receipts@x.test>');
  });
  console.log(results.join('\n'));
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})();
