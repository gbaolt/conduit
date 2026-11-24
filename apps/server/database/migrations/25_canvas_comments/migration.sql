-- CreateTable
CREATE TABLE "CanvasCommentThread" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasCommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasComment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasCommentThread_canvasId_resolvedAt_createdAt_idx" ON "CanvasCommentThread"("canvasId", "resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CanvasComment_threadId_createdAt_idx" ON "CanvasComment"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "CanvasCommentThread" ADD CONSTRAINT "CanvasCommentThread_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasCommentThread" ADD CONSTRAINT "CanvasCommentThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasCommentThread" ADD CONSTRAINT "CanvasCommentThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasCommentThread" ADD CONSTRAINT "CanvasCommentThread_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasComment" ADD CONSTRAINT "CanvasComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CanvasCommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasComment" ADD CONSTRAINT "CanvasComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
