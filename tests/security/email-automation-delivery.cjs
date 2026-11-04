const { test } = require('node:test'),
  assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { EmailAutomationsService } = require('../../apps/api/dist/admin/email-automations.service');
const { MailService } = require('../../apps/api/dist/mail/mail.service');
const draft = {
  id: 'expiry',
  name: 'Expiry reminder',
  trigger: 'MEMBERSHIP_EXPIRING',
  daysBefore: 5,
  status: 'DRAFT',
  subject: 'Your {{plan}} expires',
  body: 'Hello {{name}}: {{expiresAt}} ({{daysLeft}} days).',
};
function fixture() {
  const records = new Map();
  let sends = [],
    ready = true,
    fail = false,
    eligible = true,
    reads = 0,
    hook;
  const row = {
    id: 'sub1',
    userId: 'user1',
    plan: 'PRO',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 2 * 86400000),
    user: {
      id: 'user1',
      role: 'CREATOR',
      isVerified: true,
      email: 'creator@example.invalid',
      name: 'Creator',
    },
  };
  records.set(
    'email_automations_drafts_v1',
    JSON.stringify({ revision: 1, rules: [{ ...draft }] }),
  );
  const systemSetting = {
    findUnique: async ({ where }) => {
      if (hook) await hook(where.key);
      return records.has(where.key) ? { key: where.key, value: records.get(where.key) } : null;
    },
    create: async ({ data }) => {
      if (records.has(data.key)) throw Object.assign(Error('duplicate'), { code: 'P2002' });
      records.set(data.key, data.value);
      return data;
    },
    delete: async ({ where }) => {
      records.delete(where.key);
    },
    updateMany: async ({ where, data }) => {
      if (records.get(where.key) !== where.value) return { count: 0 };
      records.set(where.key, data.value);
      return { count: 1 };
    },
    update: async ({ where, data }) => {
      records.set(where.key, data.value);
    },
    upsert: async ({ where, create, update }) => {
      records.set(where.key, records.has(where.key) ? update.value : create.value);
    },
    count: async ({ where }) =>
      [...records.keys()].filter((k) => k.startsWith(where.key.startsWith)).length,
    findMany: async ({ where, take, skip = 0 }) =>
      [...records.entries()]
        .filter(([k]) => k.startsWith(where.key.startsWith))
        .slice(skip, skip + take)
        .map(([key, value]) => ({ key, value })),
  };
  const criteria = [];
  const prisma = {
    systemSetting,
    subscription: {
      count: async () => (eligible ? 1 : 0),
      findMany: async (q) => {
        criteria.push(q.where);
        return eligible && (!q.where.id?.gt || q.where.id.gt < row.id) ? [row] : [];
      },
      findFirst: async (q) => {
        reads++;
        criteria.push(q.where);
        return eligible ? row : null;
      },
    },
  };
  prisma.$transaction = async (f) => f(prisma);
  const mail = {
    automationReadiness: () => ({ ready, from: 'DMPilot <notifications@example.invalid>' }),
    sendAutomationEmail: async (...a) => {
      sends.push(a);
      if (fail) throw Error('timeout');
      return { provider: 'ISOLATED', reference: 'accepted1' };
    },
  };
  const service = new EmailAutomationsService(prisma, mail);
  return {
    records,
    prisma,
    service,
    mail,
    row,
    sends,
    criteria,
    set ready(v) {
      ready = v;
    },
    set fail(v) {
      fail = v;
    },
    set eligible(v) {
      eligible = v;
    },
    set hook(v) {
      hook = v;
    },
    get reads() {
      return reads;
    },
    state() {
      return JSON.parse(records.get('email_automations_drafts_v1'));
    },
    async activate() {
      const r = await service.review({ id: 'expiry', revision: this.state().revision }, 'admin1');
      await service.setStatus(
        {
          id: 'expiry',
          revision: this.state().revision,
          status: 'ACTIVE',
          reviewToken: r.reviewToken,
        },
        'admin1',
      );
      return r;
    },
  };
}
test('existing drafts stay inactive through scheduler/restart and preview never sends', async () => {
  const f = fixture();
  await f.service.tick();
  await f.service.preview({ rule: draft });
  assert.equal(f.sends.length, 0);
  assert.equal(f.state().rules[0].status, 'DRAFT');
});
test('activation requires admin-bound exact saved review, rejects stale/forged/unconfigured', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.setStatus({ id: 'expiry', revision: 1, status: 'ACTIVE' }, 'admin1'),
  );
  const review = await f.service.review({ id: 'expiry', revision: 1 }, 'admin1');
  await assert.rejects(
    f.service.setStatus(
      { id: 'expiry', revision: 1, status: 'ACTIVE', reviewToken: review.reviewToken },
      'admin2',
    ),
  );
  const stored = [...f.records.keys()].find((k) => k.startsWith('email_automation_review:'));
  const r = JSON.parse(f.records.get(stored));
  r.fingerprint = 'changed';
  f.records.set(stored, JSON.stringify(r));
  await assert.rejects(
    f.service.setStatus(
      { id: 'expiry', revision: 1, status: 'ACTIVE', reviewToken: review.reviewToken },
      'admin1',
    ),
  );
  f.ready = false;
  await assert.rejects(f.activate());
  assert.equal(f.sends.length, 0);
});
test('approved rule sends once per membership expiry, durable across repeated/concurrent workers/restarts', async () => {
  const f = fixture();
  await f.activate();
  await Promise.all([f.service.tick(), new EmailAutomationsService(f.prisma, f.mail).tick()]);
  assert.equal(f.sends.length, 1);
  assert.equal(f.sends[0][0], 'creator@example.invalid');
  assert.match(f.sends[0][2], /Hello Creator/);
  await f.service.tick();
  await f.service.tick();
  assert.equal(f.sends.length, 1);
  const h = await f.service.history();
  assert.equal(h.rows[0].status, 'ACCEPTED');
  assert.equal(h.rows[0].provider, 'ISOLATED');
  assert.equal(h.rows[0].reference, 'accepted1');
});
test('pause prevents future work; edit pauses active rule and cannot silently reactivate', async () => {
  const f = fixture();
  await f.activate();
  await f.service.save({
    revision: f.state().revision,
    rule: { ...draft, body: 'Updated reminder' },
  });
  assert.equal(f.state().rules[0].status, 'PAUSED');
  await f.service.tick();
  assert.equal(f.sends.length, 0);
  await f.activate();
  await f.service.setStatus(
    { id: 'expiry', revision: f.state().revision, status: 'PAUSED' },
    'admin1',
  );
  await f.service.tick();
  assert.equal(f.sends.length, 0);
});
test('expiry/verification/deletion/plan are rechecked, identity email cannot change unnoticed', async () => {
  const f = fixture();
  await f.activate();
  f.eligible = false;
  await f.service.tick();
  assert.equal(f.sends.length, 0);
  f.eligible = true;
  let stateReads = 0;
  f.hook = async (key) => {
    if (key === 'email_automations_drafts_v1' && ++stateReads === 3) f.eligible = false;
  };
  await f.service.tick();
  assert.equal(f.sends.length, 0);
  const check = f.criteria.find((q) => q.AND);
  assert.ok(check);
  assert.equal(check.AND[0].user.role, 'CREATOR');
  assert.equal(check.AND[0].user.isVerified, true);
  assert.deepEqual(check.AND[0].user.deleteRequest, { is: null });
  assert.deepEqual(check.AND[0].plan.in, ['PRO', 'ENTERPRISE']);
  assert.ok(check.AND[0].expiresAt.gt);
});
test('provider timeout is UNKNOWN and never auto retries; crash claims also block repeat', async () => {
  const f = fixture();
  f.fail = true;
  await f.activate();
  await f.service.tick();
  await f.service.tick();
  await f.service.tick();
  assert.equal(f.sends.length, 1);
  assert.equal((await f.service.history()).rows[0].status, 'UNKNOWN');
  const key = [...f.records.keys()].find((k) => k.startsWith('email_automation_delivery:'));
  const entry = JSON.parse(f.records.get(key));
  entry.status = 'SENDING';
  f.records.set(key, JSON.stringify(entry));
  await new EmailAutomationsService(f.prisma, f.mail).tick();
  assert.equal(f.sends.length, 1);
});
test('new membership expiry can receive once, not repeated old reminder', async () => {
  const f = fixture();
  await f.activate();
  await f.service.tick();
  f.row.expiresAt = new Date(f.row.expiresAt.getTime() + 86400000);
  await f.service.tick();
  await f.service.tick();
  assert.equal(f.sends.length, 2);
});
test('automation transport never falls back after SMTP uncertainty and fails missing provider', async () => {
  const logger = { setContext() {}, log() {}, warn() {}, error() {} };
  const mail = new MailService({ get: () => undefined }, logger);
  let fallback = 0;
  mail.getTransporter = () => ({
    sendMail: async () => {
      throw Error('timeout after accept');
    },
  });
  mail.getResend = () => {
    fallback++;
    return { emails: { send: async () => ({ data: { id: 'x' } }) } };
  };
  await assert.rejects(mail.sendAutomationEmail('x@example.invalid', 'subject', 'body', 'message'));
  assert.equal(fallback, 0);
  mail.getTransporter = () => null;
  mail.getResend = () => null;
  await assert.rejects(mail.sendAutomationEmail('x@example.invalid', 'subject', 'body', 'message'));
  assert.equal(mail.automationReadiness().ready, false);
});
test('SMTP accepted is not delivered, plain text and selected notification identity only', async () => {
  const logger = { setContext() {} };
  const mail = new MailService({ get: () => undefined }, logger);
  let sent;
  mail.getTransporter = () => ({
    sendMail: async (opts) => {
      sent = opts;
      return { accepted: ['x@example.invalid'], messageId: 'r' };
    },
  });
  mail.resolveFromAddress = () => 'Notifications <n@example.invalid>';
  mail.getSupportEmail = () => undefined;
  const r = await mail.sendAutomationEmail('x@example.invalid', 's', '<script>plain</script>', 'm');
  assert.equal(r.provider, 'SMTP');
  assert.equal(sent.text, '<script>plain</script>');
  assert.equal(sent.html, undefined);
  assert.equal(sent.from, 'Notifications <n@example.invalid>');
});
