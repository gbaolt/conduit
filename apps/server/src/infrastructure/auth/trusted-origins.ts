export function getTrustedOrigins(): string[] {
  const configured =
    process.env.BETTER_AUTH_TRUSTED_ORIGIN ?? 'http://localhost:3000';
  const origins = new Set(
    configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('https://conduit.localhost');
    origins.add('https://app.conduit.localhost');
  }

  return [...origins];
}
