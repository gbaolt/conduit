-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('CHANNEL', 'DM');

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "dmKey" TEXT,
ADD COLUMN     "kind" "ChannelKind" NOT NULL DEFAULT 'CHANNEL',
ADD COLUMN     "lastMessageAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "parentId" TEXT,
    "alsoSentToChannel" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "mentionedUserIds" TEXT[],
    "mentionsChannel" BOOLEAN NOT NULL DEFAULT false,
    "mentionsHere" BOOLEAN NOT NULL DEFAULT false,
    "reactions" JSONB NOT NULL DEFAULT '{}',
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "linkPreview" JSONB,
    "pinnedAt" TIMESTAMP(3),
    "pinnedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_channelId_parentId_createdAt_id_idx" ON "Message"("channelId", "parentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Message_channelId_updatedAt_idx" ON "Message"("channelId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_authorId_clientId_key" ON "Message"("authorId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_dmKey_key" ON "Channel"("dmKey");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
