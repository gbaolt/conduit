import { auth } from '@/infrastructure/auth/auth.config';
import { prisma } from '@/infrastructure/database/prisma.service';

import { createUser, signIn } from './auth-session';

export type Person = { userId: string; memberId: string; headers: Headers };
export type Workspace = Awaited<ReturnType<typeof createWorkspace>>;

/** A workspace created through Better Auth with an owner, an admin, and two members, each signed in. */
export async function createWorkspace() {
  const slug = `acme-${crypto.randomUUID().slice(0, 8)}`;
  const userIds: string[] = [];

  const owner = await createUser('owner');
  userIds.push(owner.id);
  const ownerHeaders = await signIn(owner.email);
  const { id: organizationId } = await auth.api.createOrganization({
    body: { name: 'Acme', slug },
    headers: ownerHeaders,
  });

  const ownerMember = await prisma.member.findFirstOrThrow({
    where: { organizationId, userId: owner.id },
  });
  const people = {
    owner: {
      userId: owner.id,
      memberId: ownerMember.id,
      headers: ownerHeaders,
    },
  } as Record<'owner' | 'admin' | 'member' | 'other', Person>;

  for (const [name, role] of [
    ['admin', 'admin'],
    ['member', 'member'],
    ['other', 'member'],
  ] as const) {
    const user = await createUser(name);
    userIds.push(user.id);
    const member = await auth.api.addMember({
      body: { userId: user.id, role, organizationId },
    });
    people[name] = {
      userId: user.id,
      memberId: member.id,
      headers: await signIn(user.email),
    };
  }

  return {
    organizationId,
    people,
    cleanup: async () => {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    },
  };
}
