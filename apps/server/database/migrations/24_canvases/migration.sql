-- CreateEnum
CREATE TYPE "CanvasRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "Canvas" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT,
    "isChannelPrimary" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "snapshotJson" JSONB,
    "markdown" TEXT NOT NULL DEFAULT '',
    "initialMarkdown" TEXT,
    "contentHash" TEXT,
    "seededAt" TIMESTAMP(3),
    "sourceThreadId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Canvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasMember" (
    "canvasId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CanvasRole" NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasMember_pkey" PRIMARY KEY ("canvasId","userId")
);

-- CreateIndex
CREATE INDEX "Canvas_organizationId_channelId_idx" ON "Canvas"("organizationId", "channelId");

-- CreateIndex
CREATE INDEX "Canvas_organizationId_updatedAt_idx" ON "Canvas"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "CanvasMember_userId_idx" ON "CanvasMember"("userId");

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasMember" ADD CONSTRAINT "CanvasMember_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasMember" ADD CONSTRAINT "CanvasMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasMember" ADD CONSTRAINT "CanvasMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One live primary canvas per channel. Prisma cannot express a partial unique index.
CREATE UNIQUE INDEX "Canvas_channelId_primary_key" ON "Canvas" ("channelId") WHERE "channelId" IS NOT NULL AND "isChannelPrimary" = true AND "deletedAt" IS NULL;
