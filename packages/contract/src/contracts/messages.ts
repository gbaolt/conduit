import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  EditMessageInputSchema,
  ListMessagesInputSchema,
  ListMessagesOutputSchema,
  ListPinnedInputSchema,
  ListPinnedOutputSchema,
  ListSavedOutputSchema,
  MessageIdInputSchema,
  MessageSchema,
  ReactionInputSchema,
  SendMessageInputSchema,
  SendMessageOutputSchema,
  UnreactInputSchema,
} from '@/schemas/messages';

export const messageErrors = {
  NOT_FOUND: { status: 404, message: 'Message not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to do that here.',
  },
  CHANNEL_ARCHIVED: { status: 409, message: 'This channel is archived.' },
  REACTION_LIMIT: {
    status: 409,
    message: 'This message has too many different reactions.',
  },
} as const;

const { NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, REACTION_LIMIT } =
  messageErrors;

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

export const reactMessageContract = oc
  .meta(
    openapi({ method: 'PUT', path: '/messages/{messageId}/reactions/{emoji}' })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, REACTION_LIMIT })
  .input(ReactionInputSchema)
  .output(MessageSchema);

export const unreactMessageContract = oc
  .meta(
    openapi({
      method: 'DELETE',
      path: '/messages/{messageId}/reactions/{emoji}',
    })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(UnreactInputSchema)
  .output(MessageSchema);

export const pinMessageContract = oc
  .meta(openapi({ method: 'PUT', path: '/messages/{messageId}/pin' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(MessageIdInputSchema)
  .output(MessageSchema);

export const unpinMessageContract = oc
  .meta(openapi({ method: 'DELETE', path: '/messages/{messageId}/pin' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(MessageIdInputSchema)
  .output(MessageSchema);

export const listPinnedMessagesContract = oc
  .meta(openapi({ method: 'GET', path: '/channels/{channelId}/pins' }))
  .errors({ NOT_FOUND })
  .input(ListPinnedInputSchema)
  .output(ListPinnedOutputSchema);

export const removeLinkPreviewContract = oc
  .meta(
    openapi({ method: 'DELETE', path: '/messages/{messageId}/link-preview' })
  )
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED })
  .input(MessageIdInputSchema)
  .output(MessageSchema);

export const saveMessageContract = oc
  .meta(openapi({ method: 'PUT', path: '/saved-messages/{messageId}' }))
  .errors({ NOT_FOUND })
  .input(MessageIdInputSchema)
  .output(z.void());

export const unsaveMessageContract = oc
  .meta(openapi({ method: 'DELETE', path: '/saved-messages/{messageId}' }))
  .input(MessageIdInputSchema)
  .output(z.void());

export const listSavedMessagesContract = oc
  .meta(openapi({ method: 'GET', path: '/saved-messages' }))
  .output(ListSavedOutputSchema);
