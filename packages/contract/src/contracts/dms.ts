import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { RoomSchema } from '@/schemas/channels';
import {
  AddDmPeopleInputSchema,
  ConvertDmInputSchema,
  DmSchema,
  ListDmsOutputSchema,
  OpenDmInputSchema,
} from '@/schemas/dms';

export const dmErrors = {
  NOT_FOUND: { status: 404, message: 'Conversation not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that here.',
  },
  DM_FULL: {
    status: 409,
    message: 'A direct message holds up to 10 people.',
  },
  DM_EXISTS: {
    status: 409,
    message: 'You already have a conversation with exactly these people.',
  },
  NAME_TAKEN: { status: 409, message: 'That channel name is already taken.' },
} as const;

const { NOT_FOUND, FORBIDDEN, DM_FULL, DM_EXISTS, NAME_TAKEN } = dmErrors;

export const listDmsContract = oc
  .meta(openapi({ method: 'GET', path: '/dms' }))
  .output(ListDmsOutputSchema);

export const openDmContract = oc
  .meta(openapi({ method: 'POST', path: '/dms' }))
  .errors({ NOT_FOUND, DM_FULL })
  .input(OpenDmInputSchema)
  .output(DmSchema);

export const addDmPeopleContract = oc
  .meta(openapi({ method: 'POST', path: '/dms/{roomId}/people' }))
  .errors({ NOT_FOUND, FORBIDDEN, DM_FULL, DM_EXISTS })
  .input(AddDmPeopleInputSchema)
  .output(DmSchema);

export const convertDmContract = oc
  .meta(openapi({ method: 'POST', path: '/dms/{roomId}/convert' }))
  .errors({ NOT_FOUND, FORBIDDEN, NAME_TAKEN })
  .input(ConvertDmInputSchema)
  .output(RoomSchema);
