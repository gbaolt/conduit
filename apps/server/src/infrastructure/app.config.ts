const DEFAULT_APP_URL = 'http://localhost:3000';

export function getAppUrl() {
  return process.env.APP_URL ?? DEFAULT_APP_URL;
}

export function getAppOrigin() {
  const appUrl = getAppUrl();
  if (!URL.canParse(appUrl)) return '';
  const url = new URL(appUrl);
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? url.origin
    : '';
}
