import type { WorkspaceRole } from '@conduit/contract';
import { ORPCError, os } from '@orpc/server';

import type { Session, User } from '@/auth/auth.config';
import { prisma } from '@/database/prisma.service';

/** The caller's role from their current `Member` row, or null when they are not in the workspace. */
export async function findWorkspaceRole(
  organizationId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!member) {
    return null;
  }

  // Better Auth stores multiple roles comma-separated.
  const roles = member.role.split(',').map((role) => role.trim());
  return roles.includes('owner')
    ? 'owner'
    : roles.includes('admin')
      ? 'admin'
      : 'member';
}

/** Chain after `authorized`. Scopes the procedure to the active workspace. */
export const workspaceMember = os
  .$context<{ user: User; session: Session['session'] }>()
  .middleware(async ({ context, next }) => {
    const organizationId = context.session.activeOrganizationId;
    const workspaceRole = organizationId
      ? await findWorkspaceRole(organizationId, context.user.id)
      : null;

    if (!organizationId || !workspaceRole) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Choose a workspace you belong to.',
      });
    }

    return next({ context: { organizationId, workspaceRole } });
  });
