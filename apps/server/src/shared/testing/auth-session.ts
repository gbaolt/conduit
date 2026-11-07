import { auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';

const PASSWORD = 'test-password-1A!';

/** A verified email-and-password user. Prisma writes the rows because the test owns them. */
export async function createUser(label: string) {
  const context = await auth.$context;
  const id = crypto.randomUUID();
  const email = `${label}-${id}@test.local`;

  await prisma.user.create({
    data: { id, email, name: label, emailVerified: true },
  });
  await prisma.account.create({
    data: {
      accountId: id,
      providerId: 'credential',
      issuer: 'local:credential', // the synthetic issuer Better Auth derives for password accounts
      userId: id,
      password: await context.password.hash(PASSWORD),
    },
  });
  return { id, email };
}

/** Headers that carry a real session for the user, the form Better Auth's server API takes. */
export async function signIn(email: string) {
  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(';')[0])
    .join('; ');
  return new Headers({ cookie });
}
