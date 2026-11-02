export const CHANNEL_NAME_MAX = 80;

// Latin letters NFKD does not decompose.
const LETTER_MAP: Record<string, string> = {
  đ: 'd',
  ß: 'ss',
  æ: 'ae',
  ø: 'o',
  ł: 'l',
  œ: 'oe',
  ı: 'i',
};

export function toAscii(raw: string) {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[đßæøłœı]/g, (letter) => LETTER_MAP[letter] ?? letter);
}

export function toChannelName(raw: string) {
  return toAscii(raw)
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CHANNEL_NAME_MAX)
    .replace(/-+$/, '');
}

export function hasNonLatinLetters(raw: string) {
  return /(?!\p{Script=Latin})\p{L}/u.test(raw);
}
