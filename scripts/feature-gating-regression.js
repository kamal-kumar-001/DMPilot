/* eslint-disable @typescript-eslint/no-var-requires */
// Isolated feature-gating regression harness for DMPilot API.
// Runs the REAL compiled services/guards from apps/api/dist against
// in-memory mocks. No network, no DB, no live calls.
const path = require('path');
const API = process.env.DMPILOT_API_ROOT || path.join(__dirname, '..', 'apps', 'api');
const { FeatureFlagService } = require(path.join(API, 'dist/billing/feature-flag.service.js'));
const { FeatureGateGuard, RequiresFeature, REQUIRED_FEATURE_KEY } = require(
  path.join(API, 'dist/billing/feature-gate.guard.js'),
);
const { CampaignService } = require(path.join(API, 'dist/campaign/campaign.service.js'));
const { InstagramService } = require(path.join(API, 'dist/instagram/instagram.service.js'));

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
    expect(pattern.test(e.message || ''), `${msg} (rejected with unexpected: ${e.message})`);
    return;
  }
  throw new Error(`${msg} (was accepted)`);
}

// ─── In-memory flag store ──────────────────────────────────────────
function makeFlagPrisma(initial) {
  const flags = new Map();
  for (const f of initial) flags.set(f.key, { isEnabled: true, ...f });
  return {
    flags,
    featureFlag: {
      findUnique: async ({ where }) => flags.get(where.key) || null,
      findMany: async () => [...flags.values()],
      upsert: async ({ where, create }) => {
        flags.set(where.key, { isEnabled: true, ...create });
        return flags.get(where.key);
      },
      update: async ({ where, data }) => {
        const cur = flags.get(where.key);
        if (!cur) throw new Error('flag not found');
        flags.set(where.key, { ...cur, ...data });
        return flags.get(where.key);
      },
    },
  };
}

const ALL_PLANS = {
  NO_BRANDING: { key: 'NO_BRANDING', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  REPLY_DESK: { key: 'REPLY_DESK', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  COMMENT_TO_DM: { key: 'COMMENT_TO_DM', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  KEYWORD_TO_DM: { key: 'KEYWORD_TO_DM', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  WELCOME_DM: { key: 'WELCOME_DM', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  STORY_REPLY_TO_DM: { key: 'STORY_REPLY_TO_DM', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  SHARE_TO_DM: { key: 'SHARE_TO_DM', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  COMMENT_REPLY: { key: 'COMMENT_REPLY', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  FOLLOW_CHECK_GATE: { key: 'FOLLOW_CHECK_GATE', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  MULTI_ACCOUNT: { key: 'MULTI_ACCOUNT', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  ANALYTICS_ADVANCED: { key: 'ANALYTICS_ADVANCED', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
  DM_VARIANTS: { key: 'DM_VARIANTS', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
};

function makeSubscriptionService(plan) {
  return {
    getOrCreate: async () => ({ id: 'sub_1', userId: 'user_1', plan, status: 'ACTIVE' }),
    getLimits: async () => ({
      limits: { max_campaigns: -1, max_keywords: -1, max_dms_per_month: -1, max_accounts: -1 },
    }),
    checkLimit: async () => ({ allowed: true, used: 0, limit: -1 }),
    incrementUsage: async () => {},
  };
}

function guardContext(user, handlerMeta) {
  const handler = function () {};
  if (handlerMeta) Reflect.defineMetadata(REQUIRED_FEATURE_KEY, handlerMeta, handler);
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
  };
}

const noopLogger = { setContext: () => {}, log: () => {}, warn: () => {}, error: () => {} };
// Minimal Reflector stand-in: reads the same metadata the decorator wrote.
const reflectorStub = { get: (key, handler) => Reflect.getMetadata(key, handler) };

(async () => {
  // ─── FeatureFlagService semantics ────────────────────────────────
  {
    const prisma = makeFlagPrisma([
      { key: 'REPLY_DESK', enabledForPlans: 'PRO,ENTERPRISE' },
      { key: 'WELCOME_DM', enabledForPlans: 'FREE,PRO,ENTERPRISE' },
      { key: 'FREE_ONLY', enabledForPlans: 'FREE' },
      { key: 'ALL_FLAG', enabledForPlans: 'ALL' },
      { key: 'KILLED', enabledForPlans: 'FREE,PRO,ENTERPRISE', isEnabled: false },
    ]);
    const svc = new FeatureFlagService(prisma);

    await test('restricted flag blocks FREE', async () => {
      expect((await svc.isEnabled('REPLY_DESK', 'FREE')) === false, 'FREE should be blocked');
    });
    await test('restricted flag allows PRO and ENTERPRISE', async () => {
      expect(await svc.isEnabled('REPLY_DESK', 'PRO'), 'PRO allowed');
      expect(await svc.isEnabled('REPLY_DESK', 'ENTERPRISE'), 'ENTERPRISE allowed');
    });
    await test('unrestricted flag allows every plan', async () => {
      for (const p of ['FREE', 'PRO', 'ENTERPRISE'])
        expect(await svc.isEnabled('WELCOME_DM', p), `${p} allowed`);
    });
    await test('FREE-listed flag no longer leaks to PRO (regression: old includes(FREE) bug)', async () => {
      expect(
        (await svc.isEnabled('FREE_ONLY', 'PRO')) === false,
        'PRO must not inherit FREE-only flag',
      );
      expect(await svc.isEnabled('FREE_ONLY', 'FREE'), 'FREE keeps it');
    });
    await test('ALL keyword allows every plan', async () => {
      expect(await svc.isEnabled('ALL_FLAG', 'FREE'), 'ALL covers FREE');
    });
    await test('global kill switch blocks every plan', async () => {
      expect((await svc.isEnabled('KILLED', 'ENTERPRISE')) === false, 'killed flag off for all');
    });
    await test('unknown flag defaults to enabled (fail open for unseeded)', async () => {
      expect(await svc.isEnabled('NO_SUCH_FLAG', 'FREE'), 'unknown flag open');
    });
    await test('assertEnabled throws upgrade error for blocked plan', async () => {
      await expectReject(
        () => svc.assertEnabled('REPLY_DESK', 'FREE'),
        /not included in your current plan \(FREE\).*Upgrade/,
        'assertEnabled must reject FREE',
      );
    });
    await test('admin plan restriction takes effect immediately', async () => {
      await svc.updatePlans('WELCOME_DM', ['PRO', 'ENTERPRISE']);
      expect(
        (await svc.isEnabled('WELCOME_DM', 'FREE')) === false,
        'FREE blocked after admin update',
      );
      expect(await svc.isEnabled('WELCOME_DM', 'PRO'), 'PRO still allowed');
    });
  }

  // ─── FeatureGateGuard ────────────────────────────────────────────
  {
    const prisma = makeFlagPrisma([
      { key: 'ANALYTICS_ADVANCED', enabledForPlans: 'PRO,ENTERPRISE' },
    ]);
    const flags = new FeatureFlagService(prisma);

    await test('guard allows route without @RequiresFeature', async () => {
      const guard = new FeatureGateGuard(reflectorStub, flags, makeSubscriptionService('FREE'));
      expect(
        await guard.canActivate(guardContext({ id: 'u1', role: 'CREATOR' }, undefined)),
        'open route',
      );
    });
    await test('guard blocks FREE on gated route with upgrade message', async () => {
      const guard = new FeatureGateGuard(reflectorStub, flags, makeSubscriptionService('FREE'));
      await expectReject(
        () => guard.canActivate(guardContext({ id: 'u1', role: 'CREATOR' }, 'ANALYTICS_ADVANCED')),
        /ANALYTICS_ADVANCED is not included in your current plan \(FREE\)/,
        'FREE gated out',
      );
    });
    await test('guard allows PRO on gated route', async () => {
      const guard = new FeatureGateGuard(reflectorStub, flags, makeSubscriptionService('PRO'));
      expect(
        await guard.canActivate(guardContext({ id: 'u1', role: 'CREATOR' }, 'ANALYTICS_ADVANCED')),
        'PRO allowed',
      );
    });
    await test('guard bypasses for ADMIN even when plan gated', async () => {
      const guard = new FeatureGateGuard(reflectorStub, flags, makeSubscriptionService('FREE'));
      expect(
        await guard.canActivate(guardContext({ id: 'u1', role: 'ADMIN' }, 'ANALYTICS_ADVANCED')),
        'admin bypass',
      );
    });
  }

  // ─── CampaignService type/option gating ──────────────────────────
  function makeCampaignService(plan, flagPlans) {
    const flagList = Object.entries(ALL_PLANS).map(([k, v]) => ({
      key: k,
      enabledForPlans: (flagPlans && flagPlans[k]) || v.enabledForPlans,
    }));
    const prisma = makeFlagPrisma(flagList);
    prisma.instagramAccount = {
      findFirst: async () => ({ id: 'igacc_1', userId: 'user_1' }),
    };
    prisma.campaign = {
      findFirst: async () => ({ id: 'camp_1', userId: 'user_1', type: 'COMMENT_TO_DM' }),
      update: async () => ({ id: 'camp_1' }),
    };
    prisma.keyword = { deleteMany: async () => ({}), createMany: async () => ({}) };
    prisma.post = { deleteMany: async () => ({}), createMany: async () => ({}) };
    prisma.$transaction = async (fn) => fn(prisma);
    prisma.campaign.count = async () => 0;
    prisma.campaign.create = async ({ data }) => ({ id: 'camp_new', ...data });
    const flags = new FeatureFlagService(prisma);
    const svc = new CampaignService(
      prisma,
      { log: async () => {} },
      noopLogger,
      makeSubscriptionService(plan),
      flags,
    );
    return { svc, flags };
  }

  await test('review mode (all plans): FREE can create every campaign type', async () => {
    const { svc } = makeCampaignService('FREE');
    for (const t of [
      'COMMENT_TO_DM',
      'KEYWORD_TO_DM',
      'WELCOME_DM',
      'STORY_REPLY_TO_DM',
      'SHARE_TO_DM',
      'COMMENT_REPLY',
    ]) {
      const r = await svc.create('user_1', {
        name: 'x',
        type: t,
        instagramAccountId: '550e8400-e29b-41d4-a716-446655440000',
        replyMessage: 'hi',
      });
      expect(r.id === 'camp_new', `${t} created`);
    }
  });
  await test('restricted STORY_REPLY_TO_DM blocks FREE create', async () => {
    const { svc } = makeCampaignService('FREE', { STORY_REPLY_TO_DM: 'PRO,ENTERPRISE' });
    await expectReject(
      () =>
        svc.create('user_1', {
          name: 'x',
          type: 'STORY_REPLY_TO_DM',
          instagramAccountId: '550e8400-e29b-41d4-a716-446655440000',
          replyMessage: 'hi',
        }),
      /STORY_REPLY_TO_DM is not included in your current plan/,
      'FREE blocked from story replies',
    );
  });
  await test('restricted STORY_REPLY_TO_DM allows PRO create', async () => {
    const { svc } = makeCampaignService('PRO', { STORY_REPLY_TO_DM: 'PRO,ENTERPRISE' });
    const r = await svc.create('user_1', {
      name: 'x',
      type: 'STORY_REPLY_TO_DM',
      instagramAccountId: '550e8400-e29b-41d4-a716-446655440000',
      replyMessage: 'hi',
    });
    expect(r.id === 'camp_new', 'PRO created');
  });
  await test('FOLLOW_CHECK_GATE blocks follow-gated create on FREE', async () => {
    const { svc } = makeCampaignService('FREE', { FOLLOW_CHECK_GATE: 'PRO,ENTERPRISE' });
    await expectReject(
      () =>
        svc.create('user_1', {
          name: 'x',
          type: 'COMMENT_TO_DM',
          instagramAccountId: '550e8400-e29b-41d4-a716-446655440000',
          replyMessage: 'hi',
          followCheckEnabled: true,
        }),
      /FOLLOW_CHECK_GATE is not included/,
      'follow gate blocked',
    );
  });
  await test('COMMENT_REPLY add-on option gated on FREE, COMMENT_REPLY type also gated', async () => {
    const { svc } = makeCampaignService('FREE', { COMMENT_REPLY: 'PRO,ENTERPRISE' });
    await expectReject(
      () =>
        svc.create('user_1', {
          name: 'x',
          type: 'COMMENT_REPLY',
          instagramAccountId: '550e8400-e29b-41d4-a716-446655440000',
          replyMessage: 'hi',
        }),
      /COMMENT_REPLY is not included/,
      'COMMENT_REPLY type blocked',
    );
    await expectReject(
      () =>
        svc.create('user_1', {
          name: 'x',
          type: 'COMMENT_TO_DM',
          instagramAccountId: '550e8400-e29b-41d4-a716-446655440000',
          replyMessage: 'hi',
          commentReplyEnabled: true,
        }),
      /COMMENT_REPLY is not included/,
      'comment-reply add-on blocked',
    );
  });
  await test('update to a gated type is blocked on FREE', async () => {
    const { svc } = makeCampaignService('FREE', { WELCOME_DM: 'PRO,ENTERPRISE' });
    await expectReject(
      () => svc.update('user_1', 'camp_1', { type: 'WELCOME_DM' }),
      /WELCOME_DM is not included/,
      'update into gated type blocked',
    );
  });

  // ─── InstagramService multi-account gate ─────────────────────────
  function makeInstagramService(plan, flagPlans, existingAccounts) {
    const flagList = Object.entries(ALL_PLANS).map(([k, v]) => ({
      key: k,
      enabledForPlans: (flagPlans && flagPlans[k]) || v.enabledForPlans,
    }));
    const prisma = makeFlagPrisma(flagList);
    prisma.instagramAccount = { count: async () => existingAccounts };
    const flags = new FeatureFlagService(prisma);
    return new InstagramService(
      { get: () => undefined },
      prisma,
      { encrypt: (x) => x, decrypt: (x) => x },
      { log: async () => {} },
      noopLogger,
      { addSendDmJob: async () => {} },
      makeSubscriptionService(plan),
      { get: async () => null, set: async () => {}, del: async () => {} },
      flags,
    );
  }

  await test('first account always allowed even when MULTI_ACCOUNT restricted', async () => {
    const svc = makeInstagramService('FREE', { MULTI_ACCOUNT: 'PRO,ENTERPRISE' }, 0);
    await svc.assertCanConnectAdditionalAccount('user_1');
  });
  await test('second account blocked on FREE when MULTI_ACCOUNT restricted', async () => {
    const svc = makeInstagramService('FREE', { MULTI_ACCOUNT: 'PRO,ENTERPRISE' }, 1);
    await expectReject(
      () => svc.assertCanConnectAdditionalAccount('user_1'),
      /MULTI_ACCOUNT is not included in your current plan \(FREE\)/,
      'second account blocked',
    );
  });
  await test('second account allowed on PRO when MULTI_ACCOUNT restricted', async () => {
    const svc = makeInstagramService('PRO', { MULTI_ACCOUNT: 'PRO,ENTERPRISE' }, 1);
    await svc.assertCanConnectAdditionalAccount('user_1');
  });
  await test('review mode: second account allowed on FREE (flag all plans)', async () => {
    const svc = makeInstagramService('FREE', null, 1);
    await svc.assertCanConnectAdditionalAccount('user_1');
  });
  await test('admin bypasses multi-account gate', async () => {
    const svc = makeInstagramService('FREE', { MULTI_ACCOUNT: 'PRO,ENTERPRISE' }, 3);
    await svc.assertCanConnectAdditionalAccount('user_1', 'ADMIN');
  });

  // ─── Plan account quota from BillingPlan (admin-editable) ─────
  {
    const { SubscriptionService } = require(path.join(API, 'dist/billing/subscription.service.js'));
    const mk = (accountLimit) => {
      const prisma = {
        subscription: {
          findUnique: async () => ({
            id: 's1',
            userId: 'u1',
            plan: 'FREE',
            status: 'ACTIVE',
            expiresAt: null,
          }),
          upsert: async () => ({ id: 's1', userId: 'u1', plan: 'FREE', status: 'ACTIVE' }),
        },
        billingPlan: {
          findUnique: async () => ({
            key: 'FREE',
            campaignLimit: -1,
            keywordLimit: -1,
            dmLimitMonthly: -1,
            accountLimit,
          }),
        },
      };
      return new SubscriptionService(prisma, { get: () => undefined });
    };
    await test('admin-set account limit flows into plan limits', async () => {
      const { limits } = await mk(1).getLimits('u1');
      expect(limits.max_accounts === 1, 'max_accounts from BillingPlan.accountLimit');
    });
    await test('default -1 account limit stays unlimited (review mode)', async () => {
      const { limits } = await mk(-1).getLimits('u1');
      expect(limits.max_accounts === -1, 'unlimited preserved');
    });
  }

  // ─── Free plan: 1000 DMs/month is enforced; no-branding is never a gate ─
  {
    const { SubscriptionService } = require(path.join(API, 'dist/billing/subscription.service.js'));
    const mkDm = (used) => {
      const prisma = {
        subscription: {
          findUnique: async () => ({
            id: 's1',
            userId: 'u1',
            plan: 'FREE',
            status: 'ACTIVE',
            expiresAt: null,
          }),
          upsert: async () => ({}),
        },
        billingPlan: {
          findUnique: async () => ({
            key: 'FREE',
            campaignLimit: 2,
            keywordLimit: 5,
            dmLimitMonthly: 1000,
            accountLimit: 1,
          }),
        },
        message: { count: async () => used },
        campaign: { count: async () => 0 },
        instagramAccount: { count: async () => 1 },
      };
      return new SubscriptionService(prisma, { get: () => undefined });
    };
    await test('Free 1000 DM/month: 999 used still allowed', async () => {
      const r = await mkDm(999).checkLimit('u1', 'max_dms_per_month');
      expect(r.allowed && r.limit === 1000, 'allowed at 999/1000');
    });
    await test('Free 1000 DM/month: 1000 used blocks further sends', async () => {
      const r = await mkDm(1000).checkLimit('u1', 'max_dms_per_month');
      expect(!r.allowed && r.limit === 1000, 'blocked at 1000/1000');
    });
    await test('Free limits 2 campaigns / 5 keywords / 1 account flow from plan row', async () => {
      const { limits } = await mkDm(0).getLimits('u1');
      expect(
        limits.max_campaigns === 2 && limits.max_keywords === 5 && limits.max_accounts === 1,
        'limits',
      );
    });
    const nb = makeFlagPrisma([
      { key: 'NO_BRANDING', enabledForPlans: 'ENTERPRISE', isEnabled: false },
    ]);
    const nbSvc = new FeatureFlagService(nb);
    await test('NO_BRANDING stays enabled for FREE even if DB row is restricted/disabled', async () => {
      expect(await nbSvc.isEnabled('NO_BRANDING', 'FREE'), 'always included');
    });
    await test('admin cannot disable or plan-restrict NO_BRANDING', async () => {
      await expectReject(
        () => nbSvc.toggle('NO_BRANDING', false),
        /included for every plan/,
        'toggle',
      );
      await expectReject(
        () => nbSvc.updatePlans('NO_BRANDING', ['PRO']),
        /included for every plan/,
        'plans',
      );
    });
    await test('admin flag list marks NO_BRANDING alwaysIncluded', async () => {
      const all = await nbSvc.getAll();
      expect(all.find((f) => f.key === 'NO_BRANDING').alwaysIncluded === true, 'flag');
    });
  }

  console.log('\n' + results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
