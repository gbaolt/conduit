import { describe, expect, it } from 'vitest';

import { ReactionInputSchema } from './messages';

const accepts = (emoji: string) =>
  ReactionInputSchema.safeParse({ messageId: 'm1', emoji }).success;

describe('ReactionInputSchema', () => {
  it.each(['👍', '👍🏽', '🇻🇳', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '#️⃣'])('accepts %s', (emoji) => {
    expect(accepts(emoji)).toBe(true);
  });

  it.each(['ok', 'V', '🇻'])('refuses %s', (text) => {
    expect(accepts(text)).toBe(false);
  });
});
