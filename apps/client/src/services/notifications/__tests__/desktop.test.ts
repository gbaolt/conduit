import { describe, expect, it } from 'vitest';

import { desktopStateOf } from '../desktop';

const state = (
  permission: NotificationPermission,
  subscribed: boolean,
  supported = true
) => desktopStateOf({ supported, permission, subscribed });

describe('desktopStateOf', () => {
  it('is on only with permission and a subscription', () => {
    expect(state('granted', true)).toBe('on');
    expect(state('granted', false)).toBe('off');
    expect(state('default', true)).toBe('off');
  });

  it('is off before the member has been asked', () => {
    expect(state('default', false)).toBe('off');
  });

  it('is blocked once the browser denies permission, whatever the subscription', () => {
    expect(state('denied', false)).toBe('blocked');
    expect(state('denied', true)).toBe('blocked');
  });

  it('is unsupported where the browser has no push', () => {
    expect(state('granted', true, false)).toBe('unsupported');
  });
});
