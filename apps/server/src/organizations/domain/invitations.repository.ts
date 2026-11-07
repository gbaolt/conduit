import type { InvitationPreview, WorkspaceInvitation } from '@conduit/contract';

/** Reads the `Invitation` rows that Better Auth owns. Better Auth does every write. */
export abstract class InvitationsRepository {
  /** The workspace's invitations that are still pending and unexpired, newest first. */
  abstract listPending(organizationId: string): Promise<WorkspaceInvitation[]>;

  /** A pending, unexpired invitation by id, or null. */
  abstract findPending(
    invitationId: string
  ): Promise<(InvitationPreview & { organizationId: string }) | null>;
}
