import { describe, expect, it } from 'vitest';

import { parseMessageUrl } from './message-url';

const origin = 'https://acme.conduit.localhost';

describe('parseMessageUrl', () => {
  it('reads a channel message link', () => {
    expect(
      parseMessageUrl(`${origin}/channels/general?message=m1`, origin)
    ).toBe('m1');
  });

  it('reads a DM message link, with surrounding whitespace', () => {
    expect(parseMessageUrl(`  ${origin}/dms/d1?message=m2\n`, origin)).toBe(
      'm2'
    );
  });

  it('reads a thread reply link as the reply', () => {
    expect(
      parseMessageUrl(
        `${origin}/channels/general?thread=root&message=r1`,
        origin
      )
    ).toBe('r1');
  });

  it('reads a thread link without a message as its first message', () => {
    expect(
      parseMessageUrl(`${origin}/channels/general?thread=root`, origin)
    ).toBe('root');
  });

  it('rejects links that are not Conduit messages', () => {
    for (const text of [
      `https://evil.example/channels/general?message=m1`,
      `${origin}/channels/general`,
      `${origin}/canvases/c1?message=m1`,
      `${origin}/channels/general/extra?message=m1`,
      `see ${origin}/channels/general?message=m1`,
      '/channels/general?message=m1',
      'not a link',
      '',
    ]) {
      expect(parseMessageUrl(text, origin)).toBeNull();
    }
  });
});
