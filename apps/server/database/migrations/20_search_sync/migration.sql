-- CreateEnum
CREATE TYPE "SearchSyncKind" AS ENUM ('MESSAGE', 'FILE');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "indexedChunks" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SearchSync" (
    "kind" "SearchSyncKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "SearchSync_pkey" PRIMARY KEY ("kind","targetId")
);

-- CreateIndex
CREATE INDEX "SearchSync_organizationId_dueAt_idx" ON "SearchSync"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "SearchSync_dueAt_idx" ON "SearchSync"("dueAt");

-- AddForeignKey
ALTER TABLE "SearchSync" ADD CONSTRAINT "SearchSync_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

