export type Workspace = { id: string; name: string; slug: string };

/** The channel rows that follow a person into and out of a workspace. */
export abstract class WorkspaceMembershipRepository {
  /** Creates the workspace's default channel if it is missing, then adds each user once. */
  abstract joinDefaultChannel(
    workspace: Workspace,
    userIds: string[]
  ): Promise<void>;

  /** Removes the user's channel memberships and sections in the workspace, together. */
  abstract removeFromWorkspace(
    organizationId: string,
    userId: string
  ): Promise<void>;
}
