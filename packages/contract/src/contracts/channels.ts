import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  AddChannelMembersInputSchema,
  RoomIdInputSchema,
  ChannelMemberInputSchema,
  RoomMemberSchema,
  RoomSchema,
  CreateChannelInputSchema,
  ListChannelsInputSchema,
  MoveChannelToSectionInputSchema,
  RenameChannelInputSchema,
  SetChannelMemberRoleInputSchema,
  UpdateChannelInputSchema,
  SetChannelVisibilityInputSchema,
} from '@/schemas/channels';

export const channelErrors = {
  NOT_FOUND: { status: 404, message: 'Channel not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that in this channel.',
  },
  NAME_TAKEN: { status: 409, message: 'That channel name is already taken.' },
  DEFAULT_CHANNEL_LOCKED: {
    status: 409,
    message: 'The default channel cannot be changed this way.',
  },
  CHANNEL_ARCHIVED: { status: 409, message: 'This channel is archived.' },
  LAST_MANAGER: {
    status: 409,
    message: 'A channel needs at least one manager.',
  },
} as const;

const {
  NOT_FOUND,
  FORBIDDEN,
  NAME_TAKEN,
  DEFAULT_CHANNEL_LOCKED,
  CHANNEL_ARCHIVED,
  LAST_MANAGER,
} = channelErrors;

export const listChannelsContract = oc
  .meta(openapi({ method: 'GET', path: '/channels' }))
  .errors({ FORBIDDEN })
  .input(ListChannelsInputSchema)
  .output(z.array(RoomSchema));

export const getRoomContract = oc
  .meta(openapi({ method: 'GET', path: '/rooms/{roomId}' }))
  .errors({ NOT_FOUND })
  .input(RoomIdInputSchema)
  .output(RoomSchema);

export const createChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels' }))
  .errors({ NAME_TAKEN, FORBIDDEN })
  .input(CreateChannelInputSchema)
  .output(RoomSchema);

export const renameChannelContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channels/{roomId}/name' }))
  .errors({ NOT_FOUND, FORBIDDEN, NAME_TAKEN, CHANNEL_ARCHIVED })
  .input(RenameChannelInputSchema)
  .output(RoomSchema);

export const deleteChannelContract = oc
  .meta(openapi({ method: 'DELETE', path: '/channels/{roomId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED })
  .input(RoomIdInputSchema)
  .output(z.void());

export const joinChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{roomId}/join' }))
  .errors({ NOT_FOUND, CHANNEL_ARCHIVED })
  .input(RoomIdInputSchema)
  .output(RoomSchema);

export const leaveChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{roomId}/leave' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED })
  .input(RoomIdInputSchema)
  .output(z.void());

export const updateChannelContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channels/{roomId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(UpdateChannelInputSchema)
  .output(RoomSchema);

export const listRoomMembersContract = oc
  .meta(openapi({ method: 'GET', path: '/rooms/{roomId}/members' }))
  .errors({ NOT_FOUND })
  .input(RoomIdInputSchema)
  .output(z.array(RoomMemberSchema));

export const addChannelMembersContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{roomId}/members' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED, CHANNEL_ARCHIVED })
  .input(AddChannelMembersInputSchema)
  .output(z.void());

export const removeChannelMemberContract = oc
  .meta(
    openapi({
      method: 'DELETE',
      path: '/channels/{roomId}/members/{userId}',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED, CHANNEL_ARCHIVED })
  .input(ChannelMemberInputSchema)
  .output(z.void());

export const setChannelMemberRoleContract = oc
  .meta(
    openapi({ method: 'PATCH', path: '/channels/{roomId}/members/{userId}' })
  )
  .errors({
    NOT_FOUND,
    FORBIDDEN,
    DEFAULT_CHANNEL_LOCKED,
    CHANNEL_ARCHIVED,
    LAST_MANAGER,
  })
  .input(SetChannelMemberRoleInputSchema)
  .output(z.void());
export const archiveChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{roomId}/archive' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED, CHANNEL_ARCHIVED })
  .input(RoomIdInputSchema)
  .output(RoomSchema);

export const unarchiveChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{roomId}/unarchive' }))
  .errors({ NOT_FOUND, FORBIDDEN })
  .input(RoomIdInputSchema)
  .output(RoomSchema);

export const setChannelVisibilityContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channels/{roomId}/visibility' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED, CHANNEL_ARCHIVED })
  .input(SetChannelVisibilityInputSchema)
  .output(RoomSchema);

export const starChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{roomId}/star' }))
  .errors({ NOT_FOUND, FORBIDDEN })
  .input(RoomIdInputSchema)
  .output(z.void());

export const unstarChannelContract = oc
  .meta(openapi({ method: 'DELETE', path: '/channels/{roomId}/star' }))
  .errors({ NOT_FOUND, FORBIDDEN })
  .input(RoomIdInputSchema)
  .output(z.void());

export const moveChannelToSectionContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channels/{roomId}/section' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(MoveChannelToSectionInputSchema)
  .output(z.void());
