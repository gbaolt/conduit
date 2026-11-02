import { toChannelName } from '@conduit/contract';
import type { PrismaClient } from '@generated/prisma/client';

type Organization = { id: string; name: string; slug: string };

export async function ensureDefaultChannel(
  prisma: PrismaClient,
  organization: Organization,
  userIds: string[]
) {
  const where = { defaultForOrganizationId: organization.id };
  const select = { id: true };
  let channel = await prisma.channel.findUnique({ where, select });
  let created = 0;

  if (!channel) {
    // skipDuplicates is ON CONFLICT DO NOTHING, so a concurrent call that lost the race reads the winner's row.
    const rows = await prisma.channel.createManyAndReturn({
      data: {
        organizationId: organization.id,
        name: toChannelName(
          `all-${toChannelName(organization.name) || organization.slug}`
        ),
        defaultForOrganizationId: organization.id,
      },
      skipDuplicates: true,
      select,
    });
    created = rows.length;
    channel =
      rows[0] ?? (await prisma.channel.findUniqueOrThrow({ where, select }));
  }

  const { count: added } = await prisma.channelMember.createMany({
    data: userIds.map((userId) => ({ channelId: channel.id, userId })),
    skipDuplicates: true,
  });

  return { created, added };
}
