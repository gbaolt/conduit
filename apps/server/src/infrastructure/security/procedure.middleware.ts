import { type ArcjetNest, detectBot, slidingWindow } from '@arcjet/nest';
import { ORPCError, os } from '@orpc/server';
import type { Request } from 'express';

import type { User } from '@/infrastructure/auth/auth.config';

const bots = detectBot({
  mode: 'LIVE',
  allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW', 'CATEGORY:MONITOR'],
});

type Subject = 'user' | 'ip' | 'workspace';

const CHARACTERISTICS = {
  user: 'userId',
  ip: 'ip.src',
  workspace: 'workspaceId',
} as const satisfies Record<Subject, string>;

function characteristicsOf(
  subject: Subject,
  context: { user?: User; organizationId?: string }
) {
  if (subject === 'workspace') {
    return { workspaceId: context.organizationId ?? '' };
  }
  return context.user ? { userId: context.user.id } : {};
}

// One protect() per request: bot detection and the tier's rate limit share a call so neither double-counts.
// An anonymous tier has no user, so it limits by IP. A workspace tier chains after `workspaceMember`.
function security(maxPerMinute: number, subject: Subject = 'user') {
  const rateLimit = slidingWindow({
    mode: 'LIVE',
    characteristics: [CHARACTERISTICS[subject]],
    interval: '1m',
    max: maxPerMinute,
  });

  return os
    .$context<{
      request: Request;
      arcjet: ArcjetNest;
      user?: User;
      organizationId?: string;
    }>()
    .middleware(async ({ context, next }) => {
      const decision = await context.arcjet
        .withRule(bots)
        .withRule(rateLimit)
        .protect(
          context.request,
          // The characteristics type demands every field of every tier, so each tier sends its own through a cast.
          characteristicsOf(subject, context) as unknown as {
            userId: string;
            workspaceId: string;
          }
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
  /** Chain after `workspaceMember`. For work that spends a shared provider quota, so it limits the workspace, not the member. */
  heavyWriteByWorkspace: security(10, 'workspace'),
  readAnonymous: security(30, 'ip'),
};
