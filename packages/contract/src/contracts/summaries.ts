import { asyncIteratorObject, oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { aiErrors } from '@/contracts/ai-settings';
import { messageErrors } from '@/contracts/messages';
import {
  ChannelSummaryInputSchema,
  SummaryEventSchema,
  SummaryIdInputSchema,
  SummarySchema,
  ThreadSummaryInputSchema,
} from '@/schemas/summaries';

export const summaryErrors = {
  NOT_FOUND: { status: 404, message: 'Summary not found.' },
  NOTHING_TO_SUMMARIZE: {
    status: 409,
    message: 'There are no messages to summarize.',
  },
} as const;

const { NOT_FOUND, NOTHING_TO_SUMMARIZE } = summaryErrors;
const { AI_DISABLED, AI_UNAVAILABLE } = aiErrors;
const { FORBIDDEN, CHANNEL_ARCHIVED } = messageErrors;

export const summarizeThreadContract = oc
  .meta(openapi({ method: 'POST', path: '/messages/{messageId}/summary' }))
  .errors({ NOT_FOUND, NOTHING_TO_SUMMARIZE, AI_DISABLED, AI_UNAVAILABLE })
  .input(ThreadSummaryInputSchema)
  .output(asyncIteratorObject(SummaryEventSchema));

export const summarizeRoomContract = oc
  .meta(openapi({ method: 'POST', path: '/rooms/{roomId}/summary' }))
  .errors({ NOT_FOUND, NOTHING_TO_SUMMARIZE, AI_DISABLED, AI_UNAVAILABLE })
  .input(ChannelSummaryInputSchema)
  .output(asyncIteratorObject(SummaryEventSchema));

/** Summarizes everything the caller has not read, across their rooms. Marks nothing read. */
export const catchUpContract = oc
  .meta(openapi({ method: 'POST', path: '/summaries/catch-up' }))
  .errors({ NOTHING_TO_SUMMARIZE, AI_DISABLED, AI_UNAVAILABLE })
  .output(asyncIteratorObject(SummaryEventSchema));

export const getSummaryContract = oc
  .meta(openapi({ method: 'GET', path: '/summaries/{summaryId}' }))
  .errors({ NOT_FOUND, AI_DISABLED })
  .input(SummaryIdInputSchema)
  .output(SummarySchema);

/** Posts the summary to its thread or channel as a message from the requester. */
export const shareSummaryContract = oc
  .meta(openapi({ method: 'POST', path: '/summaries/{summaryId}/share' }))
  .errors({ NOT_FOUND, FORBIDDEN, CHANNEL_ARCHIVED, AI_DISABLED })
  .input(SummaryIdInputSchema)
  .output(SummarySchema);
