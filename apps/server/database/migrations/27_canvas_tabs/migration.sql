-- Every canvas in a channel is a tab, so the one-primary-per-channel index goes with the flag.
DROP INDEX "Canvas_channelId_primary_key";

-- AlterTable
ALTER TABLE "Canvas" DROP COLUMN "isChannelPrimary",
ADD COLUMN     "coverPreset" TEXT,
ADD COLUMN     "icon" TEXT;
