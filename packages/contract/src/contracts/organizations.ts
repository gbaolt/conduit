import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CreateOrganizationInputSchema,
  InvitationSchema,
  OrganizationSchema,
  WorkspaceMemberSchema,
} from '@/schemas/organizations';

export const organizationErrors = {
  SLUG_TAKEN: { status: 409, message: 'That URL is already taken.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that in this workspace.',
  },
} as const;

const { SLUG_TAKEN, FORBIDDEN } = organizationErrors;

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

export const listMembersContract = oc
  .meta(openapi({ method: 'GET', path: '/members' }))
  .errors({ FORBIDDEN })
  .output(z.array(WorkspaceMemberSchema));
