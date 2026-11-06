import type {
  CreateOrganizationInput,
  Invitation,
  InviteRole,
  Organization,
  WorkspaceRole,
} from '@conduit/contract';

/** Workspaces and invitations, which Better Auth owns. `headers` carry the caller's session. */
export abstract class OrganizationsGateway {
  abstract list(headers: Headers): Promise<Organization[]>;

  /** Throws `SLUG_TAKEN`. */
  abstract create(
    headers: Headers,
    input: CreateOrganizationInput
  ): Promise<Organization>;

  /** Every pending invitation, expired ones included. */
  abstract listInvitations(headers: Headers): Promise<Invitation[]>;

  abstract acceptInvitation(
    headers: Headers,
    invitationId: string
  ): Promise<{ organizationId: string }>;

  /** Sends one invitation. Reports an address that is already a member or already invited instead of throwing. */
  abstract invite(
    headers: Headers,
    organizationId: string,
    email: string,
    role: InviteRole
  ): Promise<'sent' | 'member' | 'invited'>;

  abstract cancelInvitation(
    headers: Headers,
    invitationId: string
  ): Promise<void>;

  /** Throws `NOT_FOUND`, `FORBIDDEN`, or `LAST_OWNER`. */
  abstract updateMemberRole(
    headers: Headers,
    organizationId: string,
    memberId: string,
    role: WorkspaceRole
  ): Promise<void>;

  /** Throws `NOT_FOUND`, `FORBIDDEN`, or `LAST_OWNER`. */
  abstract removeMember(
    headers: Headers,
    organizationId: string,
    memberId: string
  ): Promise<void>;
}
