import { describe, expect, it } from 'vitest';

import { matchEmojiOptions } from './emoji-picker-plugin';

const options = [
  { title: 'sweat_smile', keywords: ['sweat_smile', 'hot'] },
  { title: 'smile', keywords: ['smile', 'happy'] },
  { title: 'vietnam', keywords: ['vietnam', 'vn'] },
];

describe('matchEmojiOptions', () => {
  it('puts shortcodes that start with the query before keyword matches', () => {
    expect(matchEmojiOptions(options, 'smi').map((o) => o.title)).toEqual([
      'smile',
      'sweat_smile',
    ]);
  });

  it('matches a tag and ignores case', () => {
    expect(matchEmojiOptions(options, 'VN').map((o) => o.title)).toEqual([
      'vietnam',
    ]);
  });
});
