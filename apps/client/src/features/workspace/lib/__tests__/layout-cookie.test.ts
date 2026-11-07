import { describe, expect, it } from 'vitest';

import { parseLayout } from '../layout-cookie';

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
