import { describe, expect, it } from 'vitest';

import { plainText, PUSH_BODY_MAX, pushPayloadFor } from './push-payload';

const message = {
  id: 'm1',
  roomId: 'r1',
  parentId: null,
  body: 'Hi <@u2>, see **this** [doc](https://x.test)',
};
const channel = {
  room: { name: 'design', kind: 'channel' as const },
  authorName: 'Linh',
  mentionNames: { u2: 'Bao' },
};

describe('plainText', () => {
  it('names mentions and drops markdown markers', () => {
    expect(plainText(message.body, { u2: 'Bao' })).toBe(
      'Hi @Bao, see this doc'
    );
  });

  it('flattens blocks onto one line', () => {
    expect(plainText('# Title\n\n- one\n- two\n\n```ts\nlet a;\n```', {})).toBe(
      'Title one two let a;'
    );
  });
});

describe('pushPayloadFor', () => {
  it('titles a channel message with the author and the channel, and tags it with the room', () => {
    expect(pushPayloadFor(message, channel)).toEqual({
      title: 'Linh in #design',
      body: 'Hi @Bao, see this doc',
      url: '/channels/r1?message=m1',
      tag: 'r1',
    });
  });

  it('titles a DM message with the author alone and opens it under /dms', () => {
    const payload = pushPayloadFor(message, {
      ...channel,
      room: { name: '', kind: 'dm' },
    });
    expect(payload.title).toBe('Linh');
    expect(payload.url).toBe('/dms/r1?message=m1');
  });

  it('opens a reply in its thread panel', () => {
    expect(pushPayloadFor({ ...message, parentId: 'm0' }, channel).url).toBe(
      '/channels/r1?thread=m0&message=m1'
    );
  });

  it('cuts the body to 120 characters', () => {
    const payload = pushPayloadFor(
      { ...message, body: 'a'.repeat(500) },
      channel
    );
    expect(payload.body).toHaveLength(PUSH_BODY_MAX);
  });
});
