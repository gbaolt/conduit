import type { WorkspaceMember, WorkspaceRole } from '@conduit/contract';

/** Reads workspace membership. Better Auth owns the rows and does every write. */
export abstract class WorkspaceMembersRepository {
  /** The user's role in the workspace, or null when they are not a member. */
  abstract findRole(
    organizationId: string,
    userId: string
  ): Promise<WorkspaceRole | null>;

  /** How many of `userIds` belong to the workspace. */
  abstract count(organizationId: string, userIds: string[]): Promise<number>;

  /** Every member of the workspace, oldest first. */
  abstract list(organizationId: string): Promise<WorkspaceMember[]>;

  /** A member of the workspace by member id, or null. */
  abstract findMember(
    organizationId: string,
    memberId: string
  ): Promise<{ memberId: string; userId: string; role: WorkspaceRole } | null>;
}
