import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  RoomIdInputSchema,
  RoomMemberSchema,
  RoomSchema,
} from '@/schemas/rooms';

/** Errors of the procedures every room answers, a channel or a DM. */
export const roomErrors = {
  NOT_FOUND: { status: 404, message: 'Channel not found.' },
  NAME_TAKEN: { status: 409, message: 'That channel name is already taken.' },
  LAST_MANAGER: {
    status: 409,
    message: 'A channel needs at least one manager.',
  },
} as const;

const { NOT_FOUND } = roomErrors;

export const getRoomContract = oc
  .meta(openapi({ method: 'GET', path: '/rooms/{roomId}' }))
  .errors({ NOT_FOUND })
  .input(RoomIdInputSchema)
  .output(RoomSchema);

export const listRoomMembersContract = oc
  .meta(openapi({ method: 'GET', path: '/rooms/{roomId}/members' }))
  .errors({ NOT_FOUND })
  .input(RoomIdInputSchema)
  .output(z.array(RoomMemberSchema));
