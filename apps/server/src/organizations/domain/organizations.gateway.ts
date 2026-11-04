import type {
  CreateOrganizationInput,
  Invitation,
  Organization,
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
}
