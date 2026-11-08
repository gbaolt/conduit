import { describe, expect, it } from 'vitest';

import { CHANNEL_TEXT_MAX, UpdateChannelInputSchema } from './channels';
import { ChannelNameSchema } from './rooms';

describe('ChannelNameSchema', () => {
  it.each(['Hello World', 'xin-chào', '', '日本'])('rejects %j', (name) => {
    expect(ChannelNameSchema.safeParse(name).success).toBe(false);
  });

  it('accepts a normalized name', () => {
    expect(ChannelNameSchema.parse('hello-world')).toBe('hello-world');
  });

  it('says why a non-Latin name is refused', () => {
    const result = ChannelNameSchema.safeParse('日本');
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'Use Latin letters. Accents are fine.'
    );
  });
});

describe('UpdateChannelInputSchema', () => {
  const parse = (topic: string | null | undefined) =>
    UpdateChannelInputSchema.safeParse({ roomId: 'c1', topic });

  it('accepts a topic at the limit, null, and an omitted topic', () => {
    expect(parse('a'.repeat(CHANNEL_TEXT_MAX)).success).toBe(true);
    expect(parse(null).success).toBe(true);
    expect(parse(undefined).success).toBe(true);
  });

  it('refuses a topic one character over the limit', () => {
    const result = parse('a'.repeat(CHANNEL_TEXT_MAX + 1));
    expect(result.error?.issues[0]?.message).toBe(
      `Use ${CHANNEL_TEXT_MAX} characters or fewer.`
    );
  });

  it('measures the limit after trimming', () => {
    expect(parse(` ${'a'.repeat(CHANNEL_TEXT_MAX)} `).success).toBe(true);
  });
});
