import { describe, expect, it } from 'vitest';

import { isSafeInternalPath, withCallbackURL } from './callback-url';

describe('isSafeInternalPath', () => {
  it('accepts a path inside the app', () => {
    expect(isSafeInternalPath('/accept-invitation?id=x')).toBe(true);
    expect(isSafeInternalPath('/')).toBe(true);
  });

  it.each(['//evil.com', '/\\evil.com', '/a\\b', 'https://evil.com', '', null])(
    'rejects %j',
    (value) => {
      expect(isSafeInternalPath(value)).toBe(false);
    }
  );
});

describe('withCallbackURL', () => {
  it('keeps the query of the page to return to', () => {
    expect(withCallbackURL('/sign-in', '/accept-invitation?id=x')).toBe(
      '/sign-in?callbackURL=%2Faccept-invitation%3Fid%3Dx'
    );
  });

  it('drops an unsafe target', () => {
    expect(withCallbackURL('/sign-in', '/\\evil.com')).toBe('/sign-in');
  });
});
