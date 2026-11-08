-- AlterTable
ALTER TABLE "WorkspaceSettings" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "parentId" TEXT,
    "from" TIMESTAMP(3),
    "to" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL,
    "bullets" JSONB NOT NULL,
    "sourceMessageIds" TEXT[],
    "sharedMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Summary_requesterId_createdAt_idx" ON "Summary"("requesterId", "createdAt");

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
