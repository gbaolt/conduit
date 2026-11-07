import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { SealedStreamSchema, SealInputSchema } from '@/schemas/realtime';

export const realtimeErrors = {
  NOT_FOUND: { status: 404, message: 'Conversation not found.' },
  REALTIME_UNAVAILABLE: {
    status: 503,
    message: 'Live updates are not available right now.',
  },
} as const;

const { NOT_FOUND, REALTIME_UNAVAILABLE } = realtimeErrors;

export const sealStreamContract = oc
  .meta(openapi({ method: 'POST', path: '/realtime/seal' }))
  .errors({ NOT_FOUND, REALTIME_UNAVAILABLE })
  .input(SealInputSchema)
  .output(SealedStreamSchema);
