// Browsers read `/\evil.com` as `//evil.com`, so no backslash may appear anywhere.
export function isSafeInternalPath(
  value: string | null | undefined
): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
  );
}

export function toAbsoluteAppUrl(path: string): string {
  const pathname = isSafeInternalPath(path) ? path : '/';
  return new URL(pathname, window.location.origin).toString();
}

export function withCallbackURL(
  pathname: string,
  callbackURL: string | null | undefined
): string {
  if (!isSafeInternalPath(callbackURL) || callbackURL === '/') {
    return pathname;
  }

  const params = new URLSearchParams({ callbackURL });
  const joiner = pathname.includes('?') ? '&' : '?';
  return `${pathname}${joiner}${params.toString()}`;
}
