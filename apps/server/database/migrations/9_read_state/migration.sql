-- CreateTable
CREATE TABLE "ReadState" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "lastReadMessageId" TEXT,

    CONSTRAINT "ReadState_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateTable
CREATE TABLE "Draft" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("channelId","userId","parentId")
);

-- CreateTable
CREATE TABLE "TypingState" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL DEFAULT '',
    "until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TypingState_pkey" PRIMARY KEY ("channelId","userId","parentId")
);

-- CreateTable
CREATE TABLE "Presence" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "away" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateIndex
CREATE INDEX "ReadState_userId_idx" ON "ReadState"("userId");

-- CreateIndex
CREATE INDEX "Draft_userId_idx" ON "Draft"("userId");

-- AddForeignKey
ALTER TABLE "ReadState" ADD CONSTRAINT "ReadState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadState" ADD CONSTRAINT "ReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypingState" ADD CONSTRAINT "TypingState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypingState" ADD CONSTRAINT "TypingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
