import type {
  Workspace,
  WorkspaceMembershipRepository,
} from '@/channels/domain/workspace-membership.repository';

/**
 * Runs from Better Auth's organization hooks, after the member row is committed.
 * Failures are logged, not thrown: failing the hook cannot undo the membership change, and the backfill script repairs a miss.
 */
export class WorkspaceMembershipService {
  constructor(private readonly membership: WorkspaceMembershipRepository) {}

  async memberJoined(workspace: Workspace, userId: string) {
    try {
      await this.membership.joinDefaultChannel(workspace, [userId]);
    } catch (error) {
      console.error(
        `[channels] default channel sync failed org=${workspace.id} user=${userId}`,
        error
      );
    }
  }

  async memberRemoved(organizationId: string, userId: string) {
    try {
      await this.membership.removeFromWorkspace(organizationId, userId);
    } catch (error) {
      console.error(
        `[channels] remove failed org=${organizationId} user=${userId}`,
        error
      );
    }
  }
}
