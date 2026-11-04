import { ORPCError, os } from '@orpc/server';

import { auth } from '@/infrastructure/auth/auth.config';

export const authorized = os
  .$context<{ headers: Headers }>()
  .middleware(async ({ context, next }) => {
    const result = await auth.api.getSession({ headers: context.headers });

    if (!result) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Authentication required',
      });
    }

    return next({
      context: {
        user: result.user,
        session: result.session,
      },
    });
  });
