import { asyncIteratorObject, oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import { aiErrors } from '@/contracts/ai-settings';
import { fileErrors } from '@/contracts/files';
import {
  AskAttachmentSchema,
  AskAttachmentUploadInputSchema,
  AskAttachmentUploadSchema,
  AskChatIdInputSchema,
  AskChatSchema,
  AskChatSummarySchema,
  AskEventSchema,
  AskGuideArticleSchema,
  AskGuideInputSchema,
  AskInputSchema,
  CompleteAskAttachmentInputSchema,
} from '@/schemas/ask';

export const askErrors = {
  NOT_FOUND: { status: 404, message: 'Chat not found.' },
  CHAT_FULL: {
    status: 409,
    message: 'This chat is full. Start a new chat to ask more.',
  },
  ATTACHMENT_NOT_FOUND: { status: 404, message: 'Attachment not found.' },
  ATTACHMENT_REJECTED: {
    status: 415,
    message: 'Ask Conduit reads images, PDFs and text files.',
  },
  ARTICLE_NOT_FOUND: { status: 404, message: 'Article not found.' },
} as const;

const {
  NOT_FOUND,
  CHAT_FULL,
  ATTACHMENT_NOT_FOUND,
  ATTACHMENT_REJECTED,
  ARTICLE_NOT_FOUND,
} = askErrors;
const { UPLOAD_MISSING, STORAGE_UNAVAILABLE } = fileErrors;
const { AI_DISABLED, AI_UNAVAILABLE } = aiErrors;

/** Answers from the messages and files the caller can read, citing each, in a new chat or the one named. */
export const askQuestionContract = oc
  .meta(openapi({ method: 'POST', path: '/ask' }))
  .errors({
    NOT_FOUND,
    CHAT_FULL,
    ATTACHMENT_NOT_FOUND,
    AI_DISABLED,
    AI_UNAVAILABLE,
  })
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

/** An article of the Conduit guide that an answer cited. */
export const getAskGuideContract = oc
  .meta(openapi({ method: 'GET', path: '/ask/guide/{slug}' }))
  .errors({ ARTICLE_NOT_FOUND, AI_DISABLED })
  .input(AskGuideInputSchema)
  .output(AskGuideArticleSchema);

export const deleteAskChatContract = oc
  .meta(openapi({ method: 'DELETE', path: '/ask/chats/{chatId}' }))
  .errors({ NOT_FOUND })
  .input(AskChatIdInputSchema)
  .output(z.void());

/** Signs an upload for a file the caller will attach to a question. It belongs to the caller, not to a room. */
export const askAttachmentUrlContract = oc
  .meta(openapi({ method: 'POST', path: '/ask/attachments' }))
  .errors({ ATTACHMENT_REJECTED, AI_DISABLED, STORAGE_UNAVAILABLE })
  .input(AskAttachmentUploadInputSchema)
  .output(AskAttachmentUploadSchema);

/** Marks the caller's upload ready to send, once storage holds its bytes. */
export const completeAskAttachmentContract = oc
  .meta(
    openapi({
      method: 'POST',
      path: '/ask/attachments/{attachmentId}/complete',
    })
  )
  .errors({ ATTACHMENT_NOT_FOUND, UPLOAD_MISSING, STORAGE_UNAVAILABLE })
  .input(CompleteAskAttachmentInputSchema)
  .output(AskAttachmentSchema);
