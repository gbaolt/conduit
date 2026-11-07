import { orpc } from '@/lib/orpc';

export const workspacesQuery = orpc.organizations.list.queryOptions();
export const invitationsQuery = orpc.invitations.list.queryOptions();
export const membersQuery = orpc.members.list.queryOptions();
export const workspaceInvitationsQuery =
  orpc.invitations.listForWorkspace.queryOptions();

export const invitationPreviewQuery = (invitationId: string) =>
  orpc.invitations.get.queryOptions({ input: { invitationId }, retry: false });

export const joinLinkQuery = orpc.joinLink.get.queryOptions();
export const allowedDomainsQuery = orpc.allowedDomains.list.queryOptions();
export const joinableWorkspacesQuery =
  orpc.organizations.joinable.queryOptions();

export const joinLinkPreviewQuery = (token: string) =>
  orpc.joinLink.preview.queryOptions({ input: { token }, retry: false });
