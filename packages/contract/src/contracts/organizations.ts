import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  AllowedDomainsInputSchema,
  AllowedDomainsSchema,
  CreateInvitationsInputSchema,
  CreateInvitationsResultSchema,
  CreateOrganizationInputSchema,
  InvitationIdInputSchema,
  InvitationPreviewSchema,
  IconUploadInputSchema,
  IconUploadSchema,
  InvitationSchema,
  JoinableWorkspaceSchema,
  JoinedWorkspaceSchema,
  JoinLinkPreviewSchema,
  JoinLinkSchema,
  JoinLinkTokenInputSchema,
  MemberIdInputSchema,
  OrganizationIdInputSchema,
  OrganizationSchema,
  UpdateOrganizationInputSchema,
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
  JOIN_LINK_INVALID: {
    status: 404,
    message: 'This link is no longer valid.',
  },
  DEACTIVATED: {
    status: 403,
    message: 'Your access to this workspace is deactivated.',
  },
  PUBLIC_MAIL_DOMAIN: {
    status: 422,
    message: 'Public mail providers such as gmail.com cannot be allowed.',
  },
  INVALID_ICON: {
    status: 400,
    message: 'Use a PNG, JPEG, or WebP image under 1 MB.',
  },
  STORAGE_UNAVAILABLE: {
    status: 503,
    message: 'Image uploads are not set up for this deployment.',
  },
} as const;

const {
  SLUG_TAKEN,
  NOT_FOUND,
  FORBIDDEN,
  LAST_OWNER,
  INVITATION_NOT_FOUND,
  JOIN_LINK_INVALID,
  DEACTIVATED,
  PUBLIC_MAIL_DOMAIN,
  INVALID_ICON,
  STORAGE_UNAVAILABLE,
} = organizationErrors;

export const listOrganizationsContract = oc
  .meta(openapi({ method: 'GET', path: '/organizations' }))
  .output(z.array(OrganizationSchema));

export const createOrganizationContract = oc
  .meta(openapi({ method: 'POST', path: '/organizations' }))
  .errors({ SLUG_TAKEN })
  .input(CreateOrganizationInputSchema)
  .output(OrganizationSchema);

export const updateOrganizationContract = oc
  .meta(openapi({ method: 'PATCH', path: '/organizations/active' }))
  .errors({ SLUG_TAKEN, FORBIDDEN, INVALID_ICON, STORAGE_UNAVAILABLE })
  .input(UpdateOrganizationInputSchema)
  .output(OrganizationSchema);

export const organizationIconUploadUrlContract = oc
  .meta(openapi({ method: 'POST', path: '/organizations/active/icon' }))
  .errors({ FORBIDDEN, INVALID_ICON, STORAGE_UNAVAILABLE })
  .input(IconUploadInputSchema)
  .output(IconUploadSchema);

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

export const getJoinLinkContract = oc
  .meta(openapi({ method: 'GET', path: '/join-link' }))
  .errors({ FORBIDDEN })
  .output(JoinLinkSchema);

export const resetJoinLinkContract = oc
  .meta(openapi({ method: 'POST', path: '/join-link/reset' }))
  .errors({ FORBIDDEN })
  .output(JoinLinkSchema);

export const previewJoinLinkContract = oc
  .meta(openapi({ method: 'GET', path: '/join-link/{token}/preview' }))
  .errors({ JOIN_LINK_INVALID })
  .input(JoinLinkTokenInputSchema)
  .output(JoinLinkPreviewSchema);

export const joinWithLinkContract = oc
  .meta(openapi({ method: 'POST', path: '/join-link/{token}/join' }))
  .errors({ JOIN_LINK_INVALID, DEACTIVATED })
  .input(JoinLinkTokenInputSchema)
  .output(JoinedWorkspaceSchema);

export const listAllowedDomainsContract = oc
  .meta(openapi({ method: 'GET', path: '/allowed-domains' }))
  .errors({ FORBIDDEN })
  .output(AllowedDomainsSchema);

export const setAllowedDomainsContract = oc
  .meta(openapi({ method: 'PUT', path: '/allowed-domains' }))
  .errors({ FORBIDDEN, PUBLIC_MAIL_DOMAIN })
  .input(AllowedDomainsInputSchema)
  .output(AllowedDomainsSchema);

export const listJoinableOrganizationsContract = oc
  .meta(openapi({ method: 'GET', path: '/organizations/joinable' }))
  .output(z.array(JoinableWorkspaceSchema));

export const joinOrganizationContract = oc
  .meta(
    openapi({ method: 'POST', path: '/organizations/{organizationId}/join' })
  )
  .errors({ FORBIDDEN, DEACTIVATED })
  .input(OrganizationIdInputSchema)
  .output(JoinedWorkspaceSchema);
