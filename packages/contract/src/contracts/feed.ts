import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  ListFeedInputSchema,
  ListFeedOutputSchema,
  MarkFeedReadInputSchema,
} from '@/schemas/feed';

export const feedErrors = {
  NOT_FOUND: { status: 404, message: 'Activity not found.' },
} as const;

const { NOT_FOUND } = feedErrors;

export const listFeedContract = oc
  .meta(openapi({ method: 'GET', path: '/feed' }))
  .errors({ NOT_FOUND })
  .input(ListFeedInputSchema)
  .output(ListFeedOutputSchema);

export const markFeedReadContract = oc
  .meta(openapi({ method: 'POST', path: '/feed/read' }))
  .input(MarkFeedReadInputSchema)
  .output(z.void());

export const markAllFeedReadContract = oc
  .meta(openapi({ method: 'POST', path: '/feed/read-all' }))
  .output(z.void());
