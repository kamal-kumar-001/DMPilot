-- Additive, safe: new nullable-defaulted column, no data rewrite.
ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "accountLimit" INTEGER NOT NULL DEFAULT -1;
