import { describe, expect, it } from 'vitest';

import { layoutCookieValue, parseLayout } from '../layout-cookie';

describe('parseLayout', () => {
  it('returns undefined for a missing cookie', () => {
    expect(parseLayout(undefined)).toBeUndefined();
    expect(parseLayout('')).toBeUndefined();
  });

  it('returns undefined for a malformed cookie', () => {
    expect(parseLayout('{not json')).toBeUndefined();
    expect(parseLayout('null')).toBeUndefined();
    expect(parseLayout('[1,2]')).toBeUndefined();
    expect(parseLayout('{"channels":"20","main":80}')).toBeUndefined();
    expect(parseLayout('{"channels":20}')).toBeUndefined();
  });

  it('returns a valid layout', () => {
    expect(parseLayout('{"channels":24.5,"main":75.5}')).toEqual({
      channels: 24.5,
      main: 75.5,
    });
  });
});

describe('layoutCookieValue', () => {
  it('finds and decodes the layout among other cookies', () => {
    const saved = encodeURIComponent('{"channels":24.5,"main":75.5}');
    expect(layoutCookieValue(`theme=dark; conduit-layout=${saved}; a=b`)).toBe(
      '{"channels":24.5,"main":75.5}'
    );
  });

  it('returns undefined when the layout is missing or not decodable', () => {
    expect(layoutCookieValue('')).toBeUndefined();
    expect(layoutCookieValue('xconduit-layout=1')).toBeUndefined();
    expect(layoutCookieValue('conduit-layout=%E0%A4%A')).toBeUndefined();
  });
});
