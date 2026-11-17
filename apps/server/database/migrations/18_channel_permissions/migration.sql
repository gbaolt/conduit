-- CreateEnum
CREATE TYPE "ChannelAudience" AS ENUM ('EVERYONE', 'MANAGERS');

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "mentionEveryoneAudience" "ChannelAudience" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "postAudience" "ChannelAudience" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "replyAudience" "ChannelAudience" NOT NULL DEFAULT 'EVERYONE';
