import { describe, expect, it } from 'vitest';

import { ChannelNameInputSchema } from './channel-name-input';

const messages = (input: string) =>
  ChannelNameInputSchema.safeParse(input).error?.issues.map(
    (issue) => issue.message
  );

describe('ChannelNameInputSchema', () => {
  it('normalizes free typing', () => {
    expect(ChannelNameInputSchema.parse('Thiết kế Đồ họa')).toBe(
      'thiet-ke-do-hoa'
    );
  });

  it('rejects non-Latin scripts with one message', () => {
    expect(messages('日本チーム')).toEqual([
      'Use Latin letters. Accents are fine.',
    ]);
  });

  it('rejects input that normalizes to nothing', () => {
    expect(messages('!!!')).toEqual(['Enter a channel name.']);
  });
});
