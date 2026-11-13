-- CreateEnum
CREATE TYPE "ActivityUrgency" AS ENUM ('URGENT', 'NORMAL', 'LOW');

-- AlterTable
ALTER TABLE "ActivityItem" ADD COLUMN     "urgency" "ActivityUrgency",
ADD COLUMN     "urgencyReason" TEXT;
