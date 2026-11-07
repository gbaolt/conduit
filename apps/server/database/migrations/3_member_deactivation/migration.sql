-- CreateTable
CREATE TABLE "MemberDeactivation" (
    "memberId" TEXT NOT NULL,
    "deactivatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedById" TEXT NOT NULL,

    CONSTRAINT "MemberDeactivation_pkey" PRIMARY KEY ("memberId")
);

-- AddForeignKey
ALTER TABLE "MemberDeactivation" ADD CONSTRAINT "MemberDeactivation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
