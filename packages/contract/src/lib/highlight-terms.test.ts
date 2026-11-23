import { describe, expect, it } from 'vitest';

import { highlightTerms } from './highlight-terms';

describe('highlightTerms', () => {
  it('marks each match, case aside', () => {
    expect(highlightTerms('Pricing and pricing.', ['PRICING'])).toEqual([
      { text: 'Pricing', match: true },
      { text: ' and ', match: false },
      { text: 'pricing', match: true },
      { text: '.', match: false },
    ]);
  });

  it('prefers the longer of two overlapping terms', () => {
    expect(highlightTerms('designer', ['design', 'designer'])).toEqual([
      { text: 'designer', match: true },
    ]);
  });

  it('treats a term as text, not a pattern', () => {
    expect(highlightTerms('a+b (c)', ['a+b', '('])).toEqual([
      { text: 'a+b', match: true },
      { text: ' ', match: false },
      { text: '(', match: true },
      { text: 'c)', match: false },
    ]);
  });

  it('returns the text whole when there is nothing to mark', () => {
    expect(highlightTerms('plain', [' '])).toEqual([
      { text: 'plain', match: false },
    ]);
  });
});
