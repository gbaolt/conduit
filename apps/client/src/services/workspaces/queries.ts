import { orpc } from '@/lib/orpc';

export const workspacesQuery = orpc.organizations.list.queryOptions();
export const invitationsQuery = orpc.invitations.list.queryOptions();
export const membersQuery = orpc.members.list.queryOptions();
export const workspaceInvitationsQuery =
  orpc.invitations.listForWorkspace.queryOptions();
