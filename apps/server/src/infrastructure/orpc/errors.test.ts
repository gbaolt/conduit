import { contract } from '@conduit/contract';
import { createProcedureClient, implement, ORPCError } from '@orpc/server';
import { describe, expect, it } from 'vitest';

import { channelError } from '@/channels/domain/channel-errors';

import { translateErrors } from './errors';

describe('translateErrors', () => {
  it('turns a domain error into the contract error the client expects', async () => {
    const procedure = implement(contract.rooms.get).handler(() => {
      throw channelError('NOT_FOUND', 'Gone.');
    });
    const client = createProcedureClient(procedure, {
      context: {} as never,
      interceptors: [translateErrors],
    });

    const error = await client({ roomId: 'c1' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    const { code, message, defined } = error as ORPCError<string, unknown>;
    expect({ code, message, defined }).toEqual({
      code: 'NOT_FOUND',
      message: 'Gone.',
      defined: true,
    });
  });
});
