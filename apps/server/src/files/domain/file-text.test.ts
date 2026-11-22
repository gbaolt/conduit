import { describe, expect, it } from 'vitest';

import { readableText } from './file-text';

const encode = (text: string) => new TextEncoder().encode(text);

describe('readableText', () => {
  it('decodes UTF-8', () => {
    expect(readableText(encode('héllo, 世界'), false)).toBe('héllo, 世界');
  });

  it('drops a character the cut split in half', () => {
    const bytes = encode('ab世');
    for (const cut of [3, 4]) {
      expect(readableText(bytes.slice(0, cut), true)).toBe('ab');
    }
    expect(readableText(bytes, true)).toBe('ab世');
    expect(readableText(encode('ok 😀').slice(0, 6), true)).toBe('ok ');
  });

  it('reads a file with a NUL byte as binary', () => {
    expect(
      readableText(new Uint8Array([0x50, 0x4b, 0x00, 0x03]), false)
    ).toBeNull();
  });
});
