import { ORPCError } from '@orpc/server';
import { isAPIError } from 'better-auth/api';

export function toORPCError(error: unknown): never {
  if (isAPIError(error)) {
    throw new ORPCError(String(error.status), {
      message: error.body?.message,
      cause: error,
    });
  }

  throw error;
}
