import { describe, expect, it } from 'vitest';

import { ChannelNameSchema } from './channels';

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
