import type { WorkspaceMember, WorkspaceRole } from '@conduit/contract';

/** Reads workspace membership. Better Auth owns the rows and does every write. */
export abstract class WorkspaceMembersRepository {
  /** The user's role in the workspace, or null when they are not an active member. */
  abstract findRole(
    organizationId: string,
    userId: string
  ): Promise<WorkspaceRole | null>;

  /** How many of `userIds` are active members of the workspace. */
  abstract count(organizationId: string, userIds: string[]): Promise<number>;

  /** Every member of the workspace, oldest first. */
  abstract list(organizationId: string): Promise<WorkspaceMember[]>;

  /** A member of the workspace by member id, or null. */
  abstract findMember(
    organizationId: string,
    memberId: string
  ): Promise<{ memberId: string; userId: string; role: WorkspaceRole } | null>;

  /** Whether the user is a member of the workspace whose access is switched off. */
  abstract isDeactivated(
    organizationId: string,
    userId: string
  ): Promise<boolean>;

  /** The workspaces where the user is deactivated. */
  abstract deactivatedOrganizationIds(userId: string): Promise<string[]>;

  /** Idempotent. */
  abstract deactivate(memberId: string, deactivatedById: string): Promise<void>;

  /** Idempotent. */
  abstract reactivate(memberId: string): Promise<void>;
}
