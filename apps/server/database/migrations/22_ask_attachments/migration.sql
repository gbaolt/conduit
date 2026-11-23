-- CreateTable
CREATE TABLE "AskAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "answerId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AskAttachment_key_key" ON "AskAttachment"("key");

-- CreateIndex
CREATE INDEX "AskAttachment_answerId_idx" ON "AskAttachment"("answerId");

-- CreateIndex
CREATE INDEX "AskAttachment_createdAt_idx" ON "AskAttachment"("createdAt");

-- AddForeignKey
ALTER TABLE "AskAttachment" ADD CONSTRAINT "AskAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAttachment" ADD CONSTRAINT "AskAttachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAttachment" ADD CONSTRAINT "AskAttachment_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
