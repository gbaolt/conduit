import { ORPCError } from '@orpc/server';
import { isAPIError } from 'better-auth/api';

import { DomainError } from '@/shared/domain/domain-error';

function toORPCError(error: unknown) {
  if (error instanceof DomainError) {
    return new ORPCError(error.code, { message: error.message });
  }

  if (isAPIError(error)) {
    return new ORPCError(String(error.status), {
      message: error.body?.message,
      cause: error,
    });
  }

  return error;
}

/** A stream is read after the procedure returns, so `translateErrors` never sees what it throws. */
export async function* translateStreamErrors<T>(
  stream: AsyncIterable<T>
): AsyncGenerator<T> {
  try {
    yield* stream;
  } catch (error) {
    throw toORPCError(error);
  }
}

/** Runs inside the procedure client, so oRPC still matches each error against the contract's error map. */
export async function translateErrors<T>({
  next,
}: {
  next: () => Promise<T>;
}): Promise<T> {
  try {
    return await next();
  } catch (error) {
    throw toORPCError(error);
  }
}
