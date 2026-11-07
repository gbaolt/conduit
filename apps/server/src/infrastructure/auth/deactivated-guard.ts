import { APIError, getSessionFromCtx } from 'better-auth/api';

import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

// These routes act on the caller, not on a workspace, so they are checked only when the request names one.
const USER_SCOPED = new Set([
  '/organization/list',
  '/organization/create',
  '/organization/check-slug',
  '/organization/set-active',
  '/organization/accept-invitation',
  '/organization/reject-invitation',
  '/organization/list-user-invitations',
  '/organization/get-invitation',
]);

type GuardContext = Parameters<typeof getSessionFromCtx>[0] & {
  path: string;
  body?: { organizationId?: unknown } | null;
  query?: { organizationId?: unknown } | null;
};

const asString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

/**
 * Refuses an organization route when the signed-in user is deactivated in the workspace it targets.
 * The browser can call these routes directly, so the oRPC `workspaceMember` check alone is not enough.
 * shortcut: a route that names only an invitation id is checked against the active workspace, so a deactivated admin could cancel another workspace's invitation by switching first; the invitation route's own role check still applies.
 */
export function refuseDeactivatedMember(
  members: Pick<WorkspaceMembersRepository, 'isDeactivated'>
) {
  return async (ctx: GuardContext) => {
    if (!ctx.path.startsWith('/organization/')) return;

    const session = await getSessionFromCtx(ctx);
    if (!session) return;

    const organizationId =
      asString(ctx.body?.organizationId) ??
      asString(ctx.query?.organizationId) ??
      (USER_SCOPED.has(ctx.path)
        ? undefined
        : (session.session.activeOrganizationId ?? undefined));
    if (!organizationId) return;

    if (await members.isDeactivated(organizationId, session.user.id)) {
      throw new APIError('FORBIDDEN', {
        message: 'Your access to this workspace is deactivated.',
      });
    }
  };
}
