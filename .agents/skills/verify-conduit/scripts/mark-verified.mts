// Verification scaffolding: marks a test account's email verified in the dev database, as AGENTS.md prescribes.
import '../../../../apps/server/src/load-env';

import { prisma } from '../../../../apps/server/src/infrastructure/database/prisma.service';

const email = process.argv[2];
if (!email?.endsWith('@resend.dev')) {
  console.error('usage: mark-verified.mts delivered+<tag>@resend.dev');
  process.exit(2);
}
if (!/neon\.tech|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) {
  console.error('refusing: DATABASE_URL does not look like the dev database');
  process.exit(2);
}

const { count } = await prisma.user.updateMany({
  where: { email },
  data: { emailVerified: true },
});
await prisma.$disconnect();
if (count !== 1) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}
console.log(`verified ${email}`);
