import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  ChannelIdInputSchema,
  ChannelSchema,
  CreateChannelInputSchema,
  RenameChannelInputSchema,
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
} as const;

const {
  NOT_FOUND,
  FORBIDDEN,
  NAME_TAKEN,
  DEFAULT_CHANNEL_LOCKED,
  CHANNEL_ARCHIVED,
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
