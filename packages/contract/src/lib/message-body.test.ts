import { describe, expect, it } from 'vitest';

import {
  firstLink,
  MESSAGE_BODY_MAX,
  MessageBodySchema,
  parseMentions,
  plainText,
} from './message-body';

describe('MessageBodySchema', () => {
  it('accepts a body up to the cap', () => {
    expect(
      MessageBodySchema.safeParse('a'.repeat(MESSAGE_BODY_MAX)).success
    ).toBe(true);
  });

  it('refuses a body over the cap', () => {
    expect(
      MessageBodySchema.safeParse('a'.repeat(MESSAGE_BODY_MAX + 1)).success
    ).toBe(false);
  });

  it.each(['', '   ', '\n\t \n'])('refuses the empty body %j', (body) => {
    expect(MessageBodySchema.safeParse(body).success).toBe(false);
  });
});

describe('parseMentions', () => {
  it('reads a user mention', () => {
    expect(parseMentions('hi <@u_1>, welcome')).toEqual({
      userIds: ['u_1'],
      channel: false,
      here: false,
    });
  });

  it('reads @channel and @here', () => {
    expect(parseMentions('<@channel> and <@here>')).toEqual({
      userIds: [],
      channel: true,
      here: true,
    });
  });

  it('lists each user once, in order of first mention', () => {
    expect(parseMentions('<@b> <@a> <@b>').userIds).toEqual(['b', 'a']);
  });

  it('ignores text that only looks like a mention', () => {
    expect(parseMentions('@here <@> <@a b> <!here> mail@here.com')).toEqual({
      userIds: [],
      channel: false,
      here: false,
    });
  });
});

describe('firstLink', () => {
  it.each([
    ['see https://example.com/a?b=1 now', 'https://example.com/a?b=1'],
    ['end of sentence https://example.com.', 'https://example.com'],
    [
      '[docs](https://example.com/docs) and https://other.dev',
      'https://example.com/docs',
    ],
    ['http://example.com first, https://later.dev', 'http://example.com'],
    ['<https://example.com>', 'https://example.com'],
  ])('finds the link in %j', (body, link) => {
    expect(firstLink(body)).toBe(link);
  });

  it('is null without an http or https link', () => {
    expect(
      firstLink('mail me at a@b.co or ftp://x.dev or example.com')
    ).toBeNull();
  });
});

describe('plainText', () => {
  it('names mentions and drops markdown markers', () => {
    expect(
      plainText('Hi <@u2>, see **this** [doc](https://x.test)', { u2: 'Bao' })
    ).toBe('Hi @Bao, see this doc');
  });

  it('flattens blocks onto one line', () => {
    expect(plainText('# Title\n\n- one\n- two\n\n```ts\nlet a;\n```', {})).toBe(
      'Title one two let a;'
    );
  });
});
