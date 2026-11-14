-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "discountPaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PaymentSession" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "PaymentSession" ADD COLUMN IF NOT EXISTS "discountPaise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" INTEGER NOT NULL,
    "maxDiscountPaise" INTEGER,
    "minOrderAmountPaise" INTEGER,
    "maxRedemptions" INTEGER,
    "maxRedemptionsPerUser" INTEGER NOT NULL DEFAULT 1,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "applicablePlans" TEXT NOT NULL DEFAULT 'PRO,ENTERPRISE',
    "applicableCycles" TEXT NOT NULL DEFAULT 'MONTHLY,YEARLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "invoiceId" TEXT,
    "discountPaise" INTEGER NOT NULL,
    "orderAmountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_code_idx" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_sessionId_idx" ON "CouponRedemption"("sessionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
