import type { GuideArticle } from '../guide';

export const accounts: GuideArticle = {
  slug: 'accounts',
  title: 'Signing up and signing in',
  covers: ['F.1', 'F.2'],
  body: `- Sign up with an email and a password, or with an OAuth provider such as Google or GitHub.
- A new email account gets a one-time code by email to verify the address.
- Forgot your password? Choose **Forgot password** on the sign-in page and Conduit emails you a reset link.`,
};
