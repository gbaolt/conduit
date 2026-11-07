import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { JoinAccessRepository } from '@/organizations/domain/join-access.repository';

@Injectable()
export class PrismaJoinAccessRepository implements JoinAccessRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async getOrCreateToken(
    organizationId: string,
    createdById: string,
    token: string
  ) {
    await this.db.workspaceJoinLink.createMany({
      data: [{ organizationId, createdById, token }],
      skipDuplicates: true,
    });
    const row = await this.db.workspaceJoinLink.findUniqueOrThrow({
      where: { organizationId },
    });
    return row.token;
  }

  async replaceToken(
    organizationId: string,
    createdById: string,
    token: string
  ) {
    await this.db.workspaceJoinLink.upsert({
      where: { organizationId },
      create: { organizationId, createdById, token },
      update: { token, createdById, createdAt: new Date() },
    });
  }

  async findByToken(token: string) {
    const row = await this.db.workspaceJoinLink.findUnique({
      where: { token },
      include: { organization: { select: { name: true, logo: true } } },
    });
    return row
      ? {
          organizationId: row.organizationId,
          organizationName: row.organization.name,
          logo: row.organization.logo,
        }
      : null;
  }

  async listDomains(organizationId: string) {
    const rows = await this.db.allowedDomain.findMany({
      where: { organizationId },
      orderBy: { domain: 'asc' },
    });
    return rows.map((row) => row.domain);
  }

  async setDomains(organizationId: string, domains: string[]) {
    await this.db.$transaction([
      this.db.allowedDomain.deleteMany({
        where: { organizationId, domain: { notIn: domains } },
      }),
      this.db.allowedDomain.createMany({
        data: domains.map((domain) => ({ organizationId, domain })),
        skipDuplicates: true,
      }),
    ]);
  }

  async allowsDomain(organizationId: string, domain: string) {
    const count = await this.db.allowedDomain.count({
      where: { organizationId, domain },
    });
    return count > 0;
  }

  async listJoinable(userId: string, domain: string) {
    return this.db.organization.findMany({
      where: {
        allowedDomains: { some: { domain } },
        members: { none: { userId } },
      },
      select: { id: true, name: true, logo: true },
      orderBy: { name: 'asc' },
    });
  }
}
