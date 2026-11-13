import { describe, expect, it } from 'vitest';

import { queryFor } from './live-streams';

const viewer = { userId: 'u1', organizationId: 'org' };
const since = new Date('2026-11-07T00:00:00.000Z');

describe('queryFor', () => {
  it.each([
    { kind: 'conversation', roomId: 'r1', since },
    { kind: 'thread', roomId: 'r1', parentId: 'm1', since },
  ] as const)(
    'reads the $kind room from its database column and names it roomId',
    (stream) => {
      const { sql } = queryFor(stream, viewer);
      const selected = sql.slice('SELECT '.length, sql.indexOf(' FROM'));

      expect(selected).toContain('"channelId" AS "roomId"');
      expect(selected.split(', ')).not.toContain('"roomId"');
    }
  );

  it('reads the viewer’s unread items in rooms they are still in, and nobody else’s', () => {
    const { sql, parameters } = queryFor({ kind: 'feed' }, viewer);

    expect(sql).toContain('"channelId" AS "roomId"');
    expect(sql).toContain('JOIN "ChannelMember" cm');
    expect(sql).toContain('a."readAt" IS NULL');
    expect(parameters).toEqual(['u1', 'org']);
  });
});
