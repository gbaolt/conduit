import { type ArcjetNest, detectBot, slidingWindow } from '@arcjet/nest';
import { ORPCError, os } from '@orpc/server';
import type { Request } from 'express';

import type { User } from '@/auth/auth.config';

const bots = detectBot({
  mode: 'LIVE',
  allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW', 'CATEGORY:MONITOR'],
});

// One protect() per request: bot detection and the tier's per-user rate limit share a call so neither double-counts.
function security(maxPerMinute: number) {
  const rateLimit = slidingWindow({
    mode: 'LIVE',
    characteristics: ['userId'],
    interval: '1m',
    max: maxPerMinute,
  });

  return os
    .$context<{ request: Request; arcjet: ArcjetNest; user: User }>()
    .middleware(async ({ context, next }) => {
      const decision = await context.arcjet
        .withRule(bots)
        .withRule(rateLimit)
        .protect(context.request, { userId: context.user.id });

      if (decision.isErrored()) {
        console.warn('[arcjet] procedure decision errored', decision.reason);
      }

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          throw new ORPCError('TOO_MANY_REQUESTS', {
            message: 'Too many requests. Please try again later.',
          });
        }

        throw new ORPCError('FORBIDDEN', {
          message: 'Request blocked by security policy.',
        });
      }

      return next();
    });
}

/** Chain after `authorized`, which supplies `user`. */
export const arcjet = {
  read: security(180),
  write: security(40),
  heavyWrite: security(5),
};
