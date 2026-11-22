-- CreateTable
CREATE TABLE "AskChat" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AskChat_organizationId_ownerId_updatedAt_idx" ON "AskChat"("organizationId", "ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Answer_chatId_createdAt_idx" ON "Answer"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "AskChat" ADD CONSTRAINT "AskChat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskChat" ADD CONSTRAINT "AskChat_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "AskChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
