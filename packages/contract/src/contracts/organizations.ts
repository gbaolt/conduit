import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CreateOrganizationInputSchema,
  InvitationSchema,
  OrganizationSchema,
} from '@/schemas/organizations';

export const listOrganizationsContract = oc
  .meta(openapi({ method: 'GET', path: '/organizations' }))
  .output(z.array(OrganizationSchema));

export const createOrganizationContract = oc
  .meta(openapi({ method: 'POST', path: '/organizations' }))
  .errors({
    SLUG_TAKEN: { status: 409, message: 'That URL is already taken.' },
  })
  .input(CreateOrganizationInputSchema)
  .output(OrganizationSchema);

export const listInvitationsContract = oc
  .meta(openapi({ method: 'GET', path: '/invitations' }))
  .output(z.array(InvitationSchema));

export const acceptInvitationContract = oc
  .meta(openapi({ method: 'POST', path: '/invitations/{invitationId}/accept' }))
  .input(z.object({ invitationId: z.string() }))
  .output(z.object({ organizationId: z.string() }));
