import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  AddChannelMembersInputSchema,
  ChannelIdInputSchema,
  ChannelMemberInputSchema,
  ChannelMemberSchema,
  ChannelSchema,
  CreateChannelInputSchema,
  RenameChannelInputSchema,
  SetChannelMemberRoleInputSchema,
  UpdateChannelInputSchema,
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
  .output(z.array(ChannelSchema));

export const getChannelContract = oc
  .meta(openapi({ method: 'GET', path: '/channels/{channelId}' }))
  .errors({ NOT_FOUND })
  .input(ChannelIdInputSchema)
  .output(ChannelSchema);

export const createChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels' }))
  .errors({ NAME_TAKEN })
  .input(CreateChannelInputSchema)
  .output(ChannelSchema);

export const renameChannelContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channels/{channelId}/name' }))
  .errors({ NOT_FOUND, FORBIDDEN, NAME_TAKEN, CHANNEL_ARCHIVED })
  .input(RenameChannelInputSchema)
  .output(ChannelSchema);

export const deleteChannelContract = oc
  .meta(openapi({ method: 'DELETE', path: '/channels/{channelId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED })
  .input(ChannelIdInputSchema)
  .output(z.void());

export const joinChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{channelId}/join' }))
  .errors({ NOT_FOUND, CHANNEL_ARCHIVED })
  .input(ChannelIdInputSchema)
  .output(ChannelSchema);

export const leaveChannelContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{channelId}/leave' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED })
  .input(ChannelIdInputSchema)
  .output(z.void());

export const updateChannelContract = oc
  .meta(openapi({ method: 'PATCH', path: '/channels/{channelId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(UpdateChannelInputSchema)
  .output(ChannelSchema);

export const listChannelMembersContract = oc
  .meta(openapi({ method: 'GET', path: '/channels/{channelId}/members' }))
  .errors({ NOT_FOUND })
  .input(ChannelIdInputSchema)
  .output(z.array(ChannelMemberSchema));

export const addChannelMembersContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{channelId}/members' }))
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED, CHANNEL_ARCHIVED })
  .input(AddChannelMembersInputSchema)
  .output(z.void());

export const removeChannelMemberContract = oc
  .meta(
    openapi({
      method: 'DELETE',
      path: '/channels/{channelId}/members/{userId}',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, DEFAULT_CHANNEL_LOCKED, CHANNEL_ARCHIVED })
  .input(ChannelMemberInputSchema)
  .output(z.void());

export const setChannelMemberRoleContract = oc
  .meta(
    openapi({ method: 'PATCH', path: '/channels/{channelId}/members/{userId}' })
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
