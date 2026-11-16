import type { Room } from '@conduit/contract';
import { ORPCError } from '@orpc/client';
import { describe, expect, it } from 'vitest';

import { roomGateState } from '../room-gate';

const room = (kind: Room['kind']) => ({ id: 'room-1', kind }) as Room;

describe('roomGateState', () => {
  it('shows a held room even when its refresh failed', () => {
    expect(
      roomGateState(
        'channel',
        room('channel'),
        new ORPCError('TOO_MANY_REQUESTS')
      )
    ).toMatchObject({ status: 'ready' });
  });

  it('sends a room opened at the wrong kind of URL to its own', () => {
    expect(roomGateState('channel', room('dm'), null)).toEqual({
      status: 'moved',
      href: '/dms/room-1',
    });
    expect(roomGateState('dm', room('channel'), null)).toEqual({
      status: 'moved',
      href: '/channels/room-1',
    });
  });

  it('reports a missing room apart from one that failed to load', () => {
    expect(roomGateState('dm', undefined, new ORPCError('NOT_FOUND'))).toEqual({
      status: 'missing',
    });
    expect(
      roomGateState('dm', undefined, new ORPCError('TOO_MANY_REQUESTS'))
    ).toEqual({ status: 'failed' });
    expect(
      roomGateState('dm', undefined, new TypeError('fetch failed'))
    ).toEqual({ status: 'failed' });
  });

  it('loads while nothing has answered yet', () => {
    expect(roomGateState('channel', undefined, null)).toEqual({
      status: 'loading',
    });
  });
});
