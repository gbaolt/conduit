import { type ArcjetNest, detectBot, slidingWindow } from '@arcjet/nest';
import { ORPCError, os } from '@orpc/server';
import type { Request } from 'express';

import type { User } from '@/infrastructure/auth/auth.config';

const bots = detectBot({
  mode: 'LIVE',
  allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW', 'CATEGORY:MONITOR'],
});

// One protect() per request: bot detection and the tier's rate limit share a call so neither double-counts.
// An anonymous tier has no user, so it limits by IP.
function security(maxPerMinute: number, anonymous = false) {
  const rateLimit = slidingWindow({
    mode: 'LIVE',
    characteristics: [anonymous ? 'ip.src' : 'userId'],
    interval: '1m',
    max: maxPerMinute,
  });

  return os
    .$context<{ request: Request; arcjet: ArcjetNest; user?: User }>()
    .middleware(async ({ context, next }) => {
      const decision = await context.arcjet
        .withRule(bots)
        .withRule(rateLimit)
        .protect(
          context.request,
          context.user
            ? { userId: context.user.id }
            : // The anonymous tier limits by ip.src and sends no field; the type models only userId.
              ({} as { userId: string })
        );

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

/** Chain after `authorized`, which supplies `user`. `readAnonymous` is for signed-out procedures. */
export const arcjet = {
  read: security(180),
  write: security(40),
  heavyWrite: security(5),
  readAnonymous: security(30, true),
};
