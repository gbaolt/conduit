import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  SubscribePushInputSchema,
  UnsubscribePushInputSchema,
} from '@/schemas/push';

export const subscribePushContract = oc
  .meta(openapi({ method: 'PUT', path: '/push/subscription' }))
  .input(SubscribePushInputSchema)
  .output(z.void());

export const unsubscribePushContract = oc
  .meta(openapi({ method: 'POST', path: '/push/subscription/remove' }))
  .input(UnsubscribePushInputSchema)
  .output(z.void());
