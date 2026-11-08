import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  ConversationKeySchema,
  DraftSchema,
  HeartbeatInputSchema,
  MarkReadInputSchema,
  SaveDraftInputSchema,
} from '@/schemas/activity';

export const activityErrors = {
  NOT_FOUND: { status: 404, message: 'Conversation not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that here.',
  },
  CHANNEL_ARCHIVED: { status: 409, message: 'This channel is archived.' },
} as const;

const { NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED } = activityErrors;

export const markReadContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{channelId}/read' }))
  .errors({ NOT_FOUND })
  .input(MarkReadInputSchema)
  .output(z.void());

export const getDraftContract = oc
  .meta(openapi({ method: 'GET', path: '/channels/{channelId}/draft' }))
  .errors({ NOT_FOUND })
  .input(ConversationKeySchema)
  .output(DraftSchema);

export const saveDraftContract = oc
  .meta(openapi({ method: 'PUT', path: '/channels/{channelId}/draft' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(SaveDraftInputSchema)
  .output(z.void());

export const typingPingContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{channelId}/typing' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(ConversationKeySchema)
  .output(z.void());

export const heartbeatContract = oc
  .meta(openapi({ method: 'POST', path: '/presence' }))
  .input(HeartbeatInputSchema)
  .output(z.void());
