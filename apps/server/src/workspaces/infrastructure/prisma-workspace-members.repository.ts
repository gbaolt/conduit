import type { WorkspaceRole } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

/** Reads the `Member` rows that Better Auth's organization plugin owns. */
@Injectable()
export class PrismaWorkspaceMembersRepository implements WorkspaceMembersRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async findRole(
    organizationId: string,
    userId: string
  ): Promise<WorkspaceRole | null> {
    const member = await this.db.member.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    });
    if (!member) {
      return null;
    }

    // Better Auth stores multiple roles comma-separated.
    const roles = member.role.split(',').map((role) => role.trim());
    return roles.includes('owner')
      ? 'owner'
      : roles.includes('admin')
        ? 'admin'
        : 'member';
  }

  count(organizationId: string, userIds: string[]) {
    return this.db.member.count({
      where: { organizationId, userId: { in: userIds } },
    });
  }
}
