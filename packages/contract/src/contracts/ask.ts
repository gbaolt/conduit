import { asyncIteratorObject, oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import { aiErrors } from '@/contracts/ai-settings';
import {
  AskChatIdInputSchema,
  AskChatSchema,
  AskChatSummarySchema,
  AskEventSchema,
  AskInputSchema,
} from '@/schemas/ask';

export const askErrors = {
  NOT_FOUND: { status: 404, message: 'Chat not found.' },
  CHAT_FULL: {
    status: 409,
    message: 'This chat is full. Start a new chat to ask more.',
  },
} as const;

const { NOT_FOUND, CHAT_FULL } = askErrors;
const { AI_DISABLED, AI_UNAVAILABLE } = aiErrors;

/** Answers from the messages and files the caller can read, citing each, in a new chat or the one named. */
export const askQuestionContract = oc
  .meta(openapi({ method: 'POST', path: '/ask' }))
  .errors({ NOT_FOUND, CHAT_FULL, AI_DISABLED, AI_UNAVAILABLE })
  .input(AskInputSchema)
  .output(asyncIteratorObject(AskEventSchema));

/** The caller's newest chats in this workspace. Nobody else can read them. */
export const listAskChatsContract = oc
  .meta(openapi({ method: 'GET', path: '/ask/chats' }))
  .errors({ AI_DISABLED })
  .output(z.array(AskChatSummarySchema));

/** One of the caller's chats, with its sources read again through the caller's access now. */
export const getAskChatContract = oc
  .meta(openapi({ method: 'GET', path: '/ask/chats/{chatId}' }))
  .errors({ NOT_FOUND, AI_DISABLED })
  .input(AskChatIdInputSchema)
  .output(AskChatSchema);

export const deleteAskChatContract = oc
  .meta(openapi({ method: 'DELETE', path: '/ask/chats/{chatId}' }))
  .errors({ NOT_FOUND })
  .input(AskChatIdInputSchema)
  .output(z.void());
