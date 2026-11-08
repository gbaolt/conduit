import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  EditMessageInputSchema,
  ListMessagesInputSchema,
  ListMessagesOutputSchema,
  MessageIdInputSchema,
  MessageSchema,
  SendMessageInputSchema,
  SendMessageOutputSchema,
} from '@/schemas/messages';

export const messageErrors = {
  NOT_FOUND: { status: 404, message: 'Message not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that here.',
  },
  CHANNEL_ARCHIVED: { status: 409, message: 'This channel is archived.' },
} as const;

const { NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED } = messageErrors;

export const listMessagesContract = oc
  .meta(openapi({ method: 'GET', path: '/channels/{channelId}/messages' }))
  .errors({ NOT_FOUND })
  .input(ListMessagesInputSchema)
  .output(ListMessagesOutputSchema);

export const sendMessageContract = oc
  .meta(openapi({ method: 'POST', path: '/channels/{channelId}/messages' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(SendMessageInputSchema)
  .output(SendMessageOutputSchema);

export const editMessageContract = oc
  .meta(openapi({ method: 'PATCH', path: '/messages/{messageId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(EditMessageInputSchema)
  .output(MessageSchema);

export const deleteMessageContract = oc
  .meta(openapi({ method: 'DELETE', path: '/messages/{messageId}' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(MessageIdInputSchema)
  .output(z.void());
