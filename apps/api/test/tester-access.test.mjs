// Phase-4 tester allowlist unit tests: privileged flows fail closed unless
// PRIVILEGED_FLOWS_ENABLED=true AND a matching owner/account entry exists.
// Removal takes effect on the next action. Ordinary (non-privileged) surfaces
// never consult the allowlist.
import assert from 'node:assert/strict';

const { TesterAccessService } = await import('../dist/instagram/tester-access.service.js');
const { ContentPublishService } = await import('../dist/instagram/content-publish.service.js');
const { AdsManagementService } = await import('../dist/instagram/ads-management.service.js');
const { InstagramController } = await import('../dist/instagram/instagram.controller.js');

let pass = 0;
const ok = (m) => { pass++; console.log('  PASS', m); };

const makeService = ({ enabled = 'true', entries = [] } = {}) => {
  const audit = [];
  const prisma = {
    testerAllowlistEntry: {
      rows: entries,
      async findFirst({ where }) {
        return this.rows.find((e) =>
          e.userId === where.userId &&
          (!where.OR
            ? e.instagramAccountId === (where.instagramAccountId ?? null)
            : where.OR.some((c) => e.instagramAccountId === (c.instagramAccountId ?? null)))) || null;
      },
      async findMany() { return this.rows; },
      async create({ data }) { const row = { id: `entry-${this.rows.length}`, ...data }; this.rows.push(row); return row; },
      async findUnique({ where: w }) { return this.rows.find((e) => e.id === w.id) || null; },
      async delete({ where: w }) { const i = this.rows.findIndex((e) => e.id === w.id); return this.rows.splice(i, 1)[0]; },
    },
    instagramAccount: { async findFirst({ where }) { return where.id === 'acc-bad' ? null : { id: where.id }; } },
  };
  const config = { get: (k) => (k === 'PRIVILEGED_FLOWS_ENABLED' ? enabled : undefined) };
  const svc = new TesterAccessService(prisma, config, { log: async (e) => audit.push(e) });
  return { svc, audit, rows: prisma.testerAllowlistEntry.rows };
};

// 1. Disabled kill switch denies even allowlisted testers (rollback path).
{
  const { svc } = makeService({ enabled: 'false', entries: [{ userId: 'u1', instagramAccountId: null }] });
  await assert.rejects(svc.assertPrivilegedAction('u1', 'acc1', 'content_publish'), /tester access/);
  await assert.rejects(svc.assertPrivilegedConnect('u1'), /tester access/);
  ok('kill switch off denies privileged flows even for allowlisted testers');
}

// 2. No entry denies.
{
  const { svc, audit } = makeService();
  await assert.rejects(svc.assertPrivilegedAction('u-stranger', 'acc1', 'ads_boost_create'), /tester access/);
  assert.ok(audit.some((a) => a.action === 'tester_access.denied' && /not_on_tester_allowlist/.test(a.details)));
  ok('non-tester denied and denial audited');
}

// 3. Owner-level entry allows any account; account-level entry scopes.
{
  const { svc } = makeService({ entries: [{ userId: 'u1', instagramAccountId: null }] });
  await svc.assertPrivilegedAction('u1', 'acc1', 'content_publish');
  const { svc: svc2 } = makeService({ entries: [{ userId: 'u2', instagramAccountId: 'acc1' }] });
  await svc2.assertPrivilegedAction('u2', 'acc1', 'content_publish');
  await assert.rejects(svc2.assertPrivilegedAction('u2', 'acc2', 'content_publish'), /tester access/);
  ok('owner-level entry allows any account; account-level entry scoped to its account');
}

// 4. Removal revokes on the next action.
{
  const { svc, rows } = makeService({ entries: [{ id: 'e1', userId: 'u1', instagramAccountId: 'acc1' }] });
  await svc.assertPrivilegedAction('u1', 'acc1', 'content_publish');
  await svc.removeEntry('admin1', 'e1');
  assert.equal(rows.length, 0);
  await assert.rejects(svc.assertPrivilegedAction('u1', 'acc1', 'content_publish'), /tester access/);
  ok('removal revokes privileged access on the next action');
}

// 5. Allowlist add/remove are audited; cross-user account grants rejected.
{
  const { svc, audit } = makeService();
  await svc.addEntry('admin1', 'u1', { instagramAccountId: 'acc1' });
  await assert.rejects(svc.addEntry('admin1', 'u1', { instagramAccountId: 'acc-bad' }), /does not belong/);
  await assert.rejects(svc.addEntry('admin1', 'u1', {}), /exact instagramAccountId or explicit ownerLevel/);
  await assert.rejects(svc.addEntry('admin1', 'u1', { instagramAccountId: 'acc1', ownerLevel: true }), /mutually exclusive/);
  await svc.removeEntry('admin1', 'entry-0');
  assert.ok(audit.some((a) => a.action === 'tester_allowlist.add'));
  assert.ok(audit.some((a) => a.action === 'tester_allowlist.remove'));
  ok('allowlist add/remove audited; cross-user account grant rejected');
}

// 6. Connect flow: ordinary instagram/facebook/unified connect NOT gated;
// only the explicit unified-privileged escalation requires the allowlist.
{
  const { svc } = makeService();
  const instagramService = { getAuthUrl: () => 'https://www.instagram.com/oauth/authorize?x=1' };
  const controller = new InstagramController(instagramService, null, null, null, null, null, svc);
  const res = await controller.connect({ id: 'u1' }, 'instagram');
  assert.equal(res.url, 'https://www.instagram.com/oauth/authorize?x=1');
  const resFb = await controller.connect({ id: 'u1' }, 'facebook');
  assert.ok(resFb.url);
  const resUnified = await controller.connect({ id: 'u1' }, 'unified');
  assert.ok(resUnified.url, 'core unified login is not tester-gated');
  await assert.rejects(controller.connect({ id: 'u1' }, 'unified-privileged'), /tester access/);
  const { svc: svc2 } = makeService({ entries: [{ userId: 'u2', instagramAccountId: null }] });
  const controller2 = new InstagramController(instagramService, null, null, null, null, null, svc2);
  const resPriv = await controller2.connect({ id: 'u2' }, 'unified-privileged');
  assert.ok(resPriv.url);
  ok('core login routes ungated; unified-privileged escalation tester-gated');
}

// 7. Publish service: non-tester denied before any provider call; tester draft path works.
{
  const mk = (testerAccess) => new ContentPublishService(
    {
      instagramAccount: { async findFirst() { return { id: 'acc1', instagramId: 'ig1', accessToken: 'enc' }; } },
      postPublish: { async create({ data }) { return { id: 'post1', ...data }; }, async update() { return {}; } },
    },
    { async decrypt() { return 'token'; } },
    { post: async () => ({ data: { id: 'c1' } }), get: async () => ({ data: { status_code: 'FINISHED', id: 'm1', permalink: 'p' } }) },
    testerAccess,
  );
  const { svc: denyGate } = makeService();
  await assert.rejects(
    mk(denyGate).publishMedia('u1', { instagramAccountId: 'acc1', mediaUrl: 'https://cdn.example.com/x.jpg', mediaType: 'IMAGE' }),
    /tester access/,
  );
  const { svc: allowGate } = makeService({ entries: [{ userId: 'u1', instagramAccountId: 'acc1' }] });
  const out = await mk(allowGate).publishMedia('u1', { instagramAccountId: 'acc1', mediaUrl: 'https://cdn.example.com/x.jpg', mediaType: 'IMAGE' });
  assert.ok(out);
  ok('publish denied for non-tester, allowed for tester');
}

// 8. scheduledAt bounds: invalid or >75 days rejected.
{
  const { svc: allowGate } = makeService({ entries: [{ userId: 'u1', instagramAccountId: 'acc1' }] });
  const svcPub = new ContentPublishService(
    { instagramAccount: {}, postPublish: {} },
    { async decrypt() { return 't'; } },
    { post: async () => ({ data: {} }), get: async () => ({ data: {} }) },
    allowGate,
  );
  await assert.rejects(
    svcPub.publishMedia('u1', { instagramAccountId: 'acc1', mediaUrl: 'https://cdn.example.com/x.jpg', scheduledAt: 'not-a-date' }),
    /valid date/,
  );
  await assert.rejects(
    svcPub.publishMedia('u1', { instagramAccountId: 'acc1', mediaUrl: 'https://cdn.example.com/x.jpg', scheduledAt: new Date(Date.now() - 60000).toISOString() }),
    /in the future/,
  );
  await assert.rejects(
    svcPub.publishMedia('u1', { instagramAccountId: 'acc1', mediaUrl: 'https://cdn.example.com/x.jpg', scheduledAt: new Date(Date.now() + 80 * 86400000).toISOString() }),
    /within 75 days/,
  );
  ok('scheduledAt bounds enforced');
}

// 9. Ads: non-tester denied on boost + status; tester draft path works with idempotency.
{
  const mkAds = (testerAccess, rows = []) => new AdsManagementService(
    {
      instagramAccount: { async findFirst() { return { id: 'acc1', instagramId: 'ig1' }; } },
      adCampaign: {
        rows,
        async findFirst({ where }) { return this.rows.find((r) => r.userId === where.userId && (where.clientRequestId ? r.clientRequestId === where.clientRequestId : r.id === where.id)) || null; },
        async create({ data }) { const row = { id: `ad-${this.rows.length}`, ...data }; this.rows.push(row); return row; },
        async update({ where, data }) { const row = this.rows.find((r) => r.id === where.id); Object.assign(row, data); return row; },
      },
    },
    { async decrypt() { return 't'; } },
    testerAccess,
  );
  const sharedRows = [];
  const { svc: denyGate } = makeService();
  await assert.rejects(
    mkAds(denyGate).createBoostCampaign('u1', { instagramAccountId: 'acc1', name: 'boost' }),
    /tester access/,
  );
  const { svc: allowGate } = makeService({ entries: [{ userId: 'u1', instagramAccountId: null }] });
  const ads = mkAds(allowGate, sharedRows);
  const a = await ads.createBoostCampaign('u1', { instagramAccountId: 'acc1', name: 'boost', clientRequestId: 'cr-1' });
  const b = await ads.createBoostCampaign('u1', { instagramAccountId: 'acc1', name: 'boost', clientRequestId: 'cr-1' });
  assert.equal(a.id, b.id);
  await ads.updateStatus('u1', 'ad-0', 'ACTIVE');
  await assert.rejects(mkAds(denyGate, sharedRows).updateStatus('u1', 'ad-0', 'ACTIVE'), /tester access/);
  ok('ads boost idempotent for tester, status change gated, non-tester denied');
}

// 10. Removal blocks ads mid-flight (gate evaluated per action, no caching).
{
  const { svc, rows } = makeService({ entries: [{ id: 'e1', userId: 'u1', instagramAccountId: null }] });
  const ads = new AdsManagementService(
    {
      instagramAccount: { async findFirst() { return { id: 'acc1' }; } },
      adCampaign: {
        rows: [],
        async findFirst({ where }) { return this.rows.find((r) => r.id === where.id) || null; },
        async create({ data }) { const row = { id: 'ad-0', ...data }; this.rows.push(row); return row; },
        async update({ where, data }) { const row = this.rows.find((r) => r.id === where.id); Object.assign(row, data); return row; },
      },
    },
    { async decrypt() { return 't'; } },
    svc,
  );
  await ads.createBoostCampaign('u1', { instagramAccountId: 'acc1', name: 'b' });
  await svc.removeEntry('admin1', 'e1');
  await assert.rejects(ads.updateStatus('u1', 'ad-0', 'ACTIVE'), /tester access/);
  // Pause/archive stay open: revoking tester access must never trap spend.
  await ads.updateStatus('u1', 'ad-0', 'PAUSED');
  ok('removal blocks privileged actions immediately; pause stays open as a safety action');
}

console.log(`RESULT ${pass} pass 0 fail`);
