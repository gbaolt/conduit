import type { PrismaClient } from '@generated/prisma/client';

import type {
  Workspace,
  WorkspaceMembershipRepository,
} from '@/channels/domain/workspace-membership.repository';

import { ensureDefaultChannel } from './default-channel';

export class PrismaWorkspaceMembershipRepository implements WorkspaceMembershipRepository {
  constructor(private readonly db: PrismaClient) {}

  async joinDefaultChannel(workspace: Workspace, userIds: string[]) {
    await ensureDefaultChannel(this.db, workspace, userIds);
  }

  async removeFromWorkspace(organizationId: string, userId: string) {
    await this.db.$transaction([
      this.db.roomMember.deleteMany({
        where: { userId, channel: { organizationId } },
      }),
      this.db.channelSection.deleteMany({
        where: { userId, organizationId },
      }),
    ]);
  }
}
