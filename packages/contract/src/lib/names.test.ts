import { describe, expect, it } from 'vitest';

import {
  CHANNEL_NAME_MAX,
  hasNonLatinLetters,
  toAscii,
  toChannelName,
} from './names';

describe('toChannelName', () => {
  it.each([
    ['Acme Inc.', 'acme-inc'],
    ['Công ty Đông Á', 'cong-ty-dong-a'],
    ['Straße', 'strasse'],
    ['a  b..c', 'a-b-c'],
    ['Œuvre Ærø Łódź', 'oeuvre-aero-lodz'],
    ['Işık', 'isik'],
    ['  --design_team--  ', 'design_team'],
    ['a 日 b', 'a-b'],
  ])('%s becomes %s', (raw, name) => {
    expect(toChannelName(raw)).toBe(name);
  });

  it('empties a non-Latin name and flags it', () => {
    expect(toChannelName('日本')).toBe('');
    expect(hasNonLatinLetters('日本')).toBe(true);
  });

  it(`caps at ${CHANNEL_NAME_MAX} characters`, () => {
    expect(toChannelName('a'.repeat(120))).toHaveLength(CHANNEL_NAME_MAX);
    expect(toChannelName(`${'a'.repeat(79)} b`)).toBe('a'.repeat(79));
  });
});

describe('hasNonLatinLetters', () => {
  it('is false for Latin script with diacritics', () => {
    expect(hasNonLatinLetters('Công ty Đông Á, Straße 1')).toBe(false);
  });
});

describe('toAscii', () => {
  it('lowercases and strips diacritics', () => {
    expect(toAscii('Hà Nội')).toBe('ha noi');
  });
});
