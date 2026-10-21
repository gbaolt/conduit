import { emailOTPClient, organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_SERVER_URL ?? 'https://api.conduit.localhost',
  basePath: '/auth',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [emailOTPClient(), organizationClient()],
});
