-- CreateEnum
CREATE TYPE "NotifyLevel" AS ENUM ('ALL', 'MENTIONS', 'NOTHING');

-- AlterTable
ALTER TABLE "ChannelMember" ADD COLUMN     "mutedAt" TIMESTAMP(3),
ADD COLUMN     "notify" "NotifyLevel";

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dndUntil" TIMESTAMP(3),
    "dndSchedule" JSONB,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("organizationId","userId")
);

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
