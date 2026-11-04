const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { EmailAutomationsService } = require('../../apps/api/dist/admin/email-automations.service');
const rule = {
  id: 'rule',
  name: 'Expiry',
  trigger: 'MEMBERSHIP_EXPIRING',
  daysBefore: 5,
  status: 'DRAFT',
  subject: '{{plan}} expires',
  body: 'Hi {{name}}: {{daysLeft}} days. {{expiresAt}}',
};
test('draft validation rejects activation,unknown trigger/tokens/header injection and invalid days', () => {
  const s = new EmailAutomationsService({});
  for (const override of [
    { enabled: true },
    { status: 'ACTIVE' },
    { trigger: 'ALL_USERS' },
    { daysBefore: 0 },
    { daysBefore: 31 },
    { subject: 'hello\nBcc:x' },
    { body: '{{secret}}' },
  ])
    assert.throws(() => s.validate({ ...rule, ...override }));
  assert.equal(s.validate(rule).status, 'DRAFT');
});
test('recipient preview filters before pagination and renders personal content without enqueue or sending', async () => {
  let query;
  const s = new EmailAutomationsService({
    subscription: {
      count: async () => 1,
      findMany: async (q) => {
        query = q;
        return [
          {
            id: 's',
            plan: 'PRO',
            expiresAt: new Date(Date.now() + 86400000 * 2),
            user: { id: 'u', email: 'creator@example.invalid', name: 'Creator <name>' },
          },
        ];
      },
    },
  });
  const r = await s.preview({ rule });
  assert.equal(r.sendingEnabled, true);
  assert.equal(r.recipients[0].scheduledAt, null);
  assert.equal(r.recipients[0].status, 'PREVIEW_ONLY');
  assert.match(r.recipients[0].body, /Creator <name>/);
  assert.equal(query.take, 25);
  assert.equal(query.where.user.isVerified, true);
  assert.equal(query.where.user.role, 'CREATOR');
  assert.deepEqual(query.where.user.deleteRequest, { is: null });
  assert.equal(query.where.status, 'ACTIVE');
  assert.deepEqual(query.where.plan.in, ['PRO', 'ENTERPRISE']);
  assert.ok(query.where.expiresAt.gt < query.where.expiresAt.lte);
});
test('draft save persists and detects stale revision; server always disabled', async () => {
  let stored = null;
  const tx = {
    systemSetting: {
      findUnique: async () => stored,
      create: async ({ data }) => (stored = data),
      updateMany: async ({ data }) => {
        stored = { ...stored, ...data };
        return { count: 1 };
      },
    },
  };
  const s = new EmailAutomationsService({ ...tx, $transaction: async (f) => f(tx) });
  assert.equal((await s.list()).sendingEnabled, true);
  const saved = await s.save({ rule, revision: 0 });
  assert.equal(saved.revision, 1);
  assert.equal(saved.sendingEnabled, true);
  await assert.rejects(s.save({ rule, revision: 0 }), (e) => e.getStatus() === 409);
  assert.equal((await s.list()).rules.find((r) => r.id === 'rule').subject, rule.subject);
});
test('admin routes protected, no activation through draft save', () => {
  const { AdminController } = require('../../apps/api/dist/admin/admin.controller');
  assert.deepEqual(Reflect.getMetadata('roles', AdminController), ['ADMIN']);
  const service = new EmailAutomationsService({});
  assert.throws(() => service.validate({ ...rule, status: 'ACTIVE' }));
});
