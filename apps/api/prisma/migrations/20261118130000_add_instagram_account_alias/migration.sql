-- CreateTable
CREATE TABLE "InstagramAccountAlias" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramAccountAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccountAlias_identifier_key" ON "InstagramAccountAlias"("identifier");

-- CreateIndex
CREATE INDEX "InstagramAccountAlias_accountId_idx" ON "InstagramAccountAlias"("accountId");

-- AddForeignKey
ALTER TABLE "InstagramAccountAlias" ADD CONSTRAINT "InstagramAccountAlias_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
