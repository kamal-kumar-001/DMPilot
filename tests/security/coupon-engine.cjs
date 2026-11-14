const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { CouponService } = require('../../apps/api/dist/billing/coupon.service');

function createMockPrisma(overrides = {}) {
  let redemptionsCount = overrides.userRedemptionsCount || 0;
  let coupon = overrides.coupon || {
    id: 'coupon-1',
    code: 'SAVE20',
    description: '20% discount',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountPaise: null,
    minOrderAmountPaise: null,
    maxRedemptions: 100,
    maxRedemptionsPerUser: 1,
    redemptionCount: 5,
    applicablePlans: 'PRO,ENTERPRISE',
    applicableCycles: 'MONTHLY,YEARLY',
    isActive: true,
    startsAt: new Date(Date.now() - 86400000),
    expiresAt: new Date(Date.now() + 86400000),
  };

  const planConfig = overrides.planConfig || {
    key: 'PRO',
    priceMonthly: 999,
    priceYearly: 9990,
  };

  const createdRedemptions = [];

  return {
    couponState: coupon,
    createdRedemptions,
    prisma: {
      coupon: {
        findUnique: async ({ where }) => {
          if (where.code && where.code === coupon.code) return coupon;
          if (where.id && where.id === coupon.id) return coupon;
          return null;
        },
        update: async ({ where, data }) => {
          if (data.redemptionCount?.increment) {
            coupon.redemptionCount += data.redemptionCount.increment;
          }
          return coupon;
        },
      },
      couponRedemption: {
        count: async () => redemptionsCount,
        create: async ({ data }) => {
          createdRedemptions.push(data);
          return { id: 'red-1', ...data };
        },
      },
      billingPlan: {
        findUnique: async () => planConfig,
      },
    },
  };
}

test('Coupon Engine: Valid 20% percentage discount', async () => {
  const { prisma } = createMockPrisma();
  const service = new CouponService(prisma);

  const result = await service.validateCoupon('user-1', 'save20', 'PRO', 'MONTHLY');

  assert.equal(result.valid, true);
  assert.equal(result.code, 'SAVE20');
  assert.equal(result.discountType, 'PERCENTAGE');
  // Plan price is ₹999 -> 99900 paise
  assert.equal(result.originalAmountPaise, 99900);
  // 20% of 99900 = 19980 paise
  assert.equal(result.discountPaise, 19980);
  // Net base = 99900 - 19980 = 79920 paise
  assert.equal(result.discountedBaseAmountPaise, 79920);
  // 18% GST on 79920 = 14386 paise
  assert.equal(result.taxPaise, 14386);
  // Total = 79920 + 14386 = 94306 paise
  assert.equal(result.totalAmountPaise, 94306);
});

test('Coupon Engine: Percentage discount with cap (maxDiscountPaise)', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-cap',
      code: 'BIG50',
      description: '50% off with max ₹100 cap',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscountPaise: 10000, // ₹100 cap
      minOrderAmountPaise: null,
      maxRedemptions: 10,
      maxRedemptionsPerUser: 1,
      redemptionCount: 0,
      applicablePlans: 'PRO',
      applicableCycles: 'MONTHLY',
      isActive: true,
      startsAt: new Date(Date.now() - 1000),
      expiresAt: null,
    },
  });
  const service = new CouponService(prisma);

  const result = await service.validateCoupon('user-1', 'BIG50', 'PRO', 'MONTHLY');

  assert.equal(result.valid, true);
  // 50% of 99900 would be 49950, but capped at 10000 paise
  assert.equal(result.discountPaise, 10000);
  assert.equal(result.discountedBaseAmountPaise, 89900);
});

test('Coupon Engine: Fixed amount discount in paise', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-fixed',
      code: 'FLAT300',
      description: 'Flat ₹300 off',
      discountType: 'FIXED_AMOUNT',
      discountValue: 30000, // ₹300 in paise
      maxDiscountPaise: null,
      minOrderAmountPaise: null,
      maxRedemptions: 10,
      maxRedemptionsPerUser: 1,
      redemptionCount: 0,
      applicablePlans: 'PRO',
      applicableCycles: 'MONTHLY',
      isActive: true,
      startsAt: new Date(Date.now() - 1000),
      expiresAt: null,
    },
  });
  const service = new CouponService(prisma);

  const result = await service.validateCoupon('user-1', 'FLAT300', 'PRO', 'MONTHLY');

  assert.equal(result.valid, true);
  assert.equal(result.discountPaise, 30000);
  assert.equal(result.discountedBaseAmountPaise, 69900);
  assert.equal(result.taxPaise, Math.round(69900 * 0.18));
});

test('Coupon Engine: Fixed amount discount clamped to base amount (never negative)', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-fixed-huge',
      code: 'FREEALL',
      description: '₹2000 off',
      discountType: 'FIXED_AMOUNT',
      discountValue: 200000, // ₹2000 (larger than ₹999 plan)
      maxDiscountPaise: null,
      minOrderAmountPaise: null,
      maxRedemptions: 10,
      maxRedemptionsPerUser: 1,
      redemptionCount: 0,
      applicablePlans: 'PRO',
      applicableCycles: 'MONTHLY',
      isActive: true,
      startsAt: new Date(Date.now() - 1000),
      expiresAt: null,
    },
  });
  const service = new CouponService(prisma);

  const result = await service.validateCoupon('user-1', 'FREEALL', 'PRO', 'MONTHLY');

  assert.equal(result.valid, true);
  assert.equal(result.discountPaise, 99900);
  assert.equal(result.discountedBaseAmountPaise, 0);
  assert.equal(result.taxPaise, 0);
  assert.equal(result.totalAmountPaise, 0);
});

test('Coupon Engine: Rejects inactive coupon', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-inactive',
      code: 'INACTIVE',
      isActive: false,
    },
  });
  const service = new CouponService(prisma);

  await assert.rejects(
    async () => service.validateCoupon('user-1', 'INACTIVE', 'PRO', 'MONTHLY'),
    { message: 'Invalid or inactive coupon code.' }
  );
});

test('Coupon Engine: Rejects expired coupon', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-expired',
      code: 'EXPIRED',
      isActive: true,
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
    },
  });
  const service = new CouponService(prisma);

  await assert.rejects(
    async () => service.validateCoupon('user-1', 'EXPIRED', 'PRO', 'MONTHLY'),
    { message: 'Coupon code has expired.' }
  );
});

test('Coupon Engine: Rejects coupon restricted to different plan', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-agency-only',
      code: 'AGENCYONLY',
      applicablePlans: 'ENTERPRISE',
      applicableCycles: 'MONTHLY,YEARLY',
      isActive: true,
      discountType: 'PERCENTAGE',
      discountValue: 10,
    },
  });
  const service = new CouponService(prisma);

  await assert.rejects(
    async () => service.validateCoupon('user-1', 'AGENCYONLY', 'PRO', 'MONTHLY'),
    { message: 'This coupon is not valid for the PRO plan.' }
  );
});

test('Coupon Engine: Rejects coupon restricted to annual billing', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-annual-only',
      code: 'ANNUALONLY',
      applicablePlans: 'PRO,ENTERPRISE',
      applicableCycles: 'YEARLY',
      isActive: true,
      discountType: 'PERCENTAGE',
      discountValue: 10,
    },
  });
  const service = new CouponService(prisma);

  await assert.rejects(
    async () => service.validateCoupon('user-1', 'ANNUALONLY', 'PRO', 'MONTHLY'),
    { message: 'This coupon is not valid for monthly billing.' }
  );
});

test('Coupon Engine: Rejects when global max redemptions reached', async () => {
  const { prisma } = createMockPrisma({
    coupon: {
      id: 'coupon-full',
      code: 'FULL',
      maxRedemptions: 5,
      redemptionCount: 5,
      isActive: true,
    },
  });
  const service = new CouponService(prisma);

  await assert.rejects(
    async () => service.validateCoupon('user-1', 'FULL', 'PRO', 'MONTHLY'),
    { message: 'This coupon has reached its maximum redemption limit.' }
  );
});

test('Coupon Engine: Rejects when per-user redemption limit reached', async () => {
  const { prisma } = createMockPrisma({
    userRedemptionsCount: 1, // User already used once
    coupon: {
      id: 'coupon-once',
      code: 'ONCE',
      maxRedemptionsPerUser: 1,
      redemptionCount: 1,
      isActive: true,
    },
  });
  const service = new CouponService(prisma);

  await assert.rejects(
    async () => service.validateCoupon('user-1', 'ONCE', 'PRO', 'MONTHLY'),
    { message: 'You have already used this coupon code.' }
  );
});

test('Coupon Engine: Redemption recording increments count and logs redemption', async () => {
  const { prisma, couponState, createdRedemptions } = createMockPrisma();
  const service = new CouponService(prisma);

  const initialCount = couponState.redemptionCount;
  await service.recordRedemption(prisma, {
    couponId: couponState.id,
    userId: 'user-42',
    discountPaise: 19980,
    orderAmountPaise: 94306,
    sessionId: 'session-123',
    invoiceId: 'inv-456',
  });

  assert.equal(couponState.redemptionCount, initialCount + 1);
  assert.equal(createdRedemptions.length, 1);
  assert.equal(createdRedemptions[0].userId, 'user-42');
  assert.equal(createdRedemptions[0].discountPaise, 19980);
  assert.equal(createdRedemptions[0].sessionId, 'session-123');
  assert.equal(createdRedemptions[0].invoiceId, 'inv-456');
});
