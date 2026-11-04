import '@/load-env';
import 'reflect-metadata';

import { ensureDefaultChannel } from '@/channels/infrastructure/default-channel';
import { prisma } from '@/infrastructure/database/prisma.service';

const organizations = await prisma.organization.findMany({
  select: {
    id: true,
    name: true,
    slug: true,
    members: { select: { userId: true } },
  },
});

let created = 0;
let added = 0;

for (const { members, ...organization } of organizations) {
  const result = await ensureDefaultChannel(
    prisma,
    organization,
    members.map((member) => member.userId)
  );
  created += result.created;
  added += result.added;
}

console.log(`created ${created} channels, added ${added} memberships`);
await prisma.$disconnect();
