import type { WorkspaceRole } from '@conduit/contract';

/** Reads workspace membership. Better Auth owns the rows and does every write. */
export abstract class WorkspaceMembersRepository {
  /** The user's role in the workspace, or null when they are not a member. */
  abstract findRole(
    organizationId: string,
    userId: string
  ): Promise<WorkspaceRole | null>;

  /** How many of `userIds` belong to the workspace. */
  abstract count(organizationId: string, userIds: string[]): Promise<number>;
}
