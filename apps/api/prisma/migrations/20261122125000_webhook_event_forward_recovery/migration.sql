-- CANDIDATE — source-only, not applied. Additive: two nullable/defaulted
-- columns + one index on the existing WebhookEvent table; no data changes
-- beyond the marker backfill below.
-- Durable forward-recovery checkpointing for the KeepCue DM forwarder:
-- eligibility must NOT depend on the truncatable human errorMessage.

ALTER TABLE "WebhookEvent" ADD COLUMN "forwardPersistFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebhookEvent" ADD COLUMN "forwardRecoveredAt" TIMESTAMP(3);
ALTER TABLE "WebhookEvent" ADD COLUMN "forwardRecoveryAttemptAt" TIMESTAMP(3);

-- Backfill: rows already marked by the text marker (pre-column candidates)
-- keep their recovery eligibility.
UPDATE "WebhookEvent" SET "forwardPersistFailed" = true
WHERE "errorMessage" LIKE '%KEEPCUE_FORWARD_PERSIST_FAILED%';

CREATE INDEX "WebhookEvent_forwardPersistFailed_createdAt_idx" ON "WebhookEvent"("forwardPersistFailed", "createdAt");
