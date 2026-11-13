-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('MENTION', 'THREAD_REPLY', 'REACTION', 'ROOM_ADD');

-- CreateTable
CREATE TABLE "ActivityItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "key" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "messageId" TEXT,
    "emoji" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityItem_userId_organizationId_createdAt_id_idx" ON "ActivityItem"("userId", "organizationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActivityItem_userId_organizationId_readAt_idx" ON "ActivityItem"("userId", "organizationId", "readAt");

-- CreateIndex
CREATE INDEX "ActivityItem_messageId_idx" ON "ActivityItem"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityItem_userId_key_key" ON "ActivityItem"("userId", "key");

-- AddForeignKey
ALTER TABLE "ActivityItem" ADD CONSTRAINT "ActivityItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityItem" ADD CONSTRAINT "ActivityItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityItem" ADD CONSTRAINT "ActivityItem_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityItem" ADD CONSTRAINT "ActivityItem_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
