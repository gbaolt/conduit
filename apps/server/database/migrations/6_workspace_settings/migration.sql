-- CreateEnum
CREATE TYPE "ChannelCreators" AS ENUM ('EVERYONE', 'ADMINS');

-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "organizationId" TEXT NOT NULL,
    "channelCreators" "ChannelCreators" NOT NULL DEFAULT 'EVERYONE',
    "publicChannelCreators" "ChannelCreators" NOT NULL DEFAULT 'EVERYONE',

    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
