import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CreateInvitationsInputSchema,
  CreateInvitationsResultSchema,
  CreateOrganizationInputSchema,
  InvitationIdInputSchema,
  InvitationPreviewSchema,
  InvitationSchema,
  MemberIdInputSchema,
  OrganizationSchema,
  UpdateMemberRoleInputSchema,
  WorkspaceInvitationSchema,
  WorkspaceMemberSchema,
} from '@/schemas/organizations';

export const organizationErrors = {
  SLUG_TAKEN: { status: 409, message: 'That URL is already taken.' },
  NOT_FOUND: { status: 404, message: 'Member not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that in this workspace.',
  },
  LAST_OWNER: { status: 409, message: 'A workspace needs at least one owner.' },
  INVITATION_NOT_FOUND: {
    status: 404,
    message: 'This invitation is no longer valid.',
  },
} as const;

const { SLUG_TAKEN, NOT_FOUND, FORBIDDEN, LAST_OWNER, INVITATION_NOT_FOUND } =
  organizationErrors;

export const listOrganizationsContract = oc
  .meta(openapi({ method: 'GET', path: '/organizations' }))
  .output(z.array(OrganizationSchema));

export const createOrganizationContract = oc
  .meta(openapi({ method: 'POST', path: '/organizations' }))
  .errors({ SLUG_TAKEN })
  .input(CreateOrganizationInputSchema)
  .output(OrganizationSchema);

export const listInvitationsContract = oc
  .meta(openapi({ method: 'GET', path: '/invitations' }))
  .output(z.array(InvitationSchema));

export const acceptInvitationContract = oc
  .meta(openapi({ method: 'POST', path: '/invitations/{invitationId}/accept' }))
  .input(z.object({ invitationId: z.string() }))
  .output(z.object({ organizationId: z.string() }));

export const getInvitationContract = oc
  .meta(openapi({ method: 'GET', path: '/invitations/{invitationId}' }))
  .errors({ INVITATION_NOT_FOUND })
  .input(InvitationIdInputSchema)
  .output(InvitationPreviewSchema);

export const createInvitationsContract = oc
  .meta(openapi({ method: 'POST', path: '/workspace-invitations' }))
  .errors({ FORBIDDEN })
  .input(CreateInvitationsInputSchema)
  .output(CreateInvitationsResultSchema);

export const listWorkspaceInvitationsContract = oc
  .meta(openapi({ method: 'GET', path: '/workspace-invitations' }))
  .errors({ FORBIDDEN })
  .output(z.array(WorkspaceInvitationSchema));

export const revokeInvitationContract = oc
  .meta(
    openapi({ method: 'DELETE', path: '/workspace-invitations/{invitationId}' })
  )
  .errors({ FORBIDDEN, INVITATION_NOT_FOUND })
  .input(InvitationIdInputSchema)
  .output(z.void());

export const listMembersContract = oc
  .meta(openapi({ method: 'GET', path: '/members' }))
  .errors({ FORBIDDEN })
  .output(z.array(WorkspaceMemberSchema));

export const updateMemberRoleContract = oc
  .meta(openapi({ method: 'PATCH', path: '/members/{memberId}/role' }))
  .errors({ NOT_FOUND, FORBIDDEN, LAST_OWNER })
  .input(UpdateMemberRoleInputSchema)
  .output(z.void());

export const removeMemberContract = oc
  .meta(openapi({ method: 'DELETE', path: '/members/{memberId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, LAST_OWNER })
  .input(MemberIdInputSchema)
  .output(z.void());

export const deactivateMemberContract = oc
  .meta(openapi({ method: 'POST', path: '/members/{memberId}/deactivate' }))
  .errors({ NOT_FOUND, FORBIDDEN })
  .input(MemberIdInputSchema)
  .output(z.void());

export const reactivateMemberContract = oc
  .meta(openapi({ method: 'POST', path: '/members/{memberId}/reactivate' }))
  .errors({ NOT_FOUND, FORBIDDEN })
  .input(MemberIdInputSchema)
  .output(z.void());
