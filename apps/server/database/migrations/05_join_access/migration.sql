-- CreateTable
CREATE TABLE "WorkspaceJoinLink" (
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceJoinLink_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "AllowedDomain" (
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "AllowedDomain_pkey" PRIMARY KEY ("organizationId","domain")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceJoinLink_token_key" ON "WorkspaceJoinLink"("token");

-- CreateIndex
CREATE INDEX "AllowedDomain_domain_idx" ON "AllowedDomain"("domain");

-- AddForeignKey
ALTER TABLE "WorkspaceJoinLink" ADD CONSTRAINT "WorkspaceJoinLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllowedDomain" ADD CONSTRAINT "AllowedDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
