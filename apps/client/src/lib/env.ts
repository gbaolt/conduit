export function getServerBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SERVER_URL ??
    process.env.SERVER_URL ??
    'https://api.conduit.localhost'
  );
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.conduit.localhost';
}

export function getMarketingBaseUrl() {
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://conduit.localhost';
}

/** The public half of the server's VAPID key pair. Empty turns desktop notifications off. */
export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
}
