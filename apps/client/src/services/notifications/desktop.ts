/** What a member sees for this browser: notifications `on`, `off`, `blocked` in the browser's settings, or `unsupported` here. */
export type DesktopState = 'on' | 'off' | 'blocked' | 'unsupported';

export function desktopStateOf({
  supported,
  permission,
  subscribed,
}: {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}): DesktopState {
  if (!supported) return 'unsupported';
  if (permission === 'denied') return 'blocked';
  return permission === 'granted' && subscribed ? 'on' : 'off';
}
