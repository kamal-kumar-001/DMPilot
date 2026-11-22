-- CANDIDATE - source-only, not applied. Additive: new table only.
CREATE TABLE "DmForwardOutbox" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "recipientIgId" TEXT NOT NULL,
    "igsid" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rawBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DmForwardOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DmForwardOutbox_appId_recipientIgId_igsid_messageId_key" ON "DmForwardOutbox"("appId", "recipientIgId", "igsid", "messageId");
CREATE INDEX "DmForwardOutbox_status_createdAt_idx" ON "DmForwardOutbox"("status", "createdAt");
