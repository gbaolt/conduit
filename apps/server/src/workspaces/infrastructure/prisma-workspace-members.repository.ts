import type { WorkspaceMember, WorkspaceRole } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

// Better Auth stores multiple roles comma-separated.
function toWorkspaceRole(stored: string): WorkspaceRole {
  const roles = stored.split(',').map((role) => role.trim());
  if (roles.includes('owner')) return 'owner';
  return roles.includes('admin') ? 'admin' : 'member';
}

/** Reads the `Member` rows that Better Auth's organization plugin owns. */
@Injectable()
export class PrismaWorkspaceMembersRepository implements WorkspaceMembersRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async findRole(
    organizationId: string,
    userId: string
  ): Promise<WorkspaceRole | null> {
    const member = await this.db.member.findFirst({
      where: { organizationId, userId, deactivation: null },
      select: { role: true },
    });
    return member ? toWorkspaceRole(member.role) : null;
  }

  count(organizationId: string, userIds: string[]) {
    return this.db.member.count({
      where: { organizationId, userId: { in: userIds }, deactivation: null },
    });
  }

  async findMember(organizationId: string, memberId: string) {
    const member = await this.db.member.findFirst({
      where: { id: memberId, organizationId },
      select: { id: true, userId: true, role: true },
    });
    return member
      ? {
          memberId: member.id,
          userId: member.userId,
          role: toWorkspaceRole(member.role),
        }
      : null;
  }

  async list(organizationId: string): Promise<WorkspaceMember[]> {
    const members = await this.db.member.findMany({
      where: { organizationId },
      include: { user: true, deactivation: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return members.map((member) => ({
      memberId: member.id,
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: toWorkspaceRole(member.role),
      status: member.deactivation ? 'deactivated' : 'active',
      joinedAt: member.createdAt,
    }));
  }

  async isDeactivated(organizationId: string, userId: string) {
    const count = await this.db.memberDeactivation.count({
      where: { member: { organizationId, userId } },
    });
    return count > 0;
  }

  async deactivatedOrganizationIds(userId: string) {
    const rows = await this.db.member.findMany({
      where: { userId, deactivation: { isNot: null } },
      select: { organizationId: true },
    });
    return rows.map((row) => row.organizationId);
  }

  async deactivate(memberId: string, deactivatedById: string) {
    await this.db.memberDeactivation.upsert({
      where: { memberId },
      create: { memberId, deactivatedById },
      update: {},
    });
  }

  async reactivate(memberId: string) {
    await this.db.memberDeactivation.deleteMany({ where: { memberId } });
  }
}
