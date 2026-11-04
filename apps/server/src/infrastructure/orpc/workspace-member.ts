import { ORPCError, os } from '@orpc/server';

import type { Session, User } from '@/infrastructure/auth/auth.config';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

/** Chain after `authorized`. Scopes the procedure to the active workspace. */
export const workspaceMember = os
  .$context<{
    user: User;
    session: Session['session'];
    workspaceMembers: WorkspaceMembersRepository;
  }>()
  .middleware(async ({ context, next }) => {
    const organizationId = context.session.activeOrganizationId;
    const workspaceRole = organizationId
      ? await context.workspaceMembers.findRole(organizationId, context.user.id)
      : null;

    if (!organizationId || !workspaceRole) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Choose a workspace you belong to.',
      });
    }

    return next({ context: { organizationId, workspaceRole } });
  });
