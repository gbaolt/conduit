// Tests that boot Better Auth need these before `auth.config` loads; never reach the shared database or send email.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
process.env.BETTER_AUTH_SECRET ??=
  'test-only-secret-for-better-auth-0123456789';
delete process.env.RESEND_API_KEY;
