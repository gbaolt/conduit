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
}
