import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { sectionError } from '@/channels/domain/channel-errors';
import type {
  ChannelSectionsRepository,
  SectionScope,
} from '@/channels/domain/channel-sections.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const select = { id: true, name: true, position: true } as const;

// Callers pass wider viewers, and Prisma rejects any key that is not a column.
const owner = ({ userId, organizationId }: SectionScope) => ({
  userId,
  organizationId,
});

// The only unique a create or rename can hit is (userId, organizationId, name).
function rethrowNameTaken(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw sectionError('NAME_TAKEN');
  }
  throw error;
}

@Injectable()
export class PrismaChannelSectionsRepository implements ChannelSectionsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  list(scope: SectionScope) {
    return this.db.channelSection.findMany({
      where: owner(scope),
      select,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Appends the section after the scope's last one. */
  async create(scope: SectionScope, name: string) {
    const last = await this.db.channelSection.aggregate({
      where: owner(scope),
      _max: { position: true },
    });
    return this.db.channelSection
      .create({
        data: {
          ...owner(scope),
          name,
          position: (last._max.position ?? -1) + 1,
        },
        select,
      })
      .catch(rethrowNameTaken);
  }

  rename(sectionId: string, name: string) {
    return this.db.channelSection
      .update({ where: { id: sectionId }, data: { name }, select })
      .catch(rethrowNameTaken);
  }

  /** The section's channels fall back to Channels through `onDelete: SetNull`. */
  async delete(sectionId: string) {
    await this.db.channelSection.delete({ where: { id: sectionId } });
  }

  async exists(scope: SectionScope, sectionId: string) {
    const section = await this.db.channelSection.findFirst({
      where: { ...owner(scope), id: sectionId },
      select: { id: true },
    });
    return section !== null;
  }

  /** How many of `sectionIds` the scope owns. */
  count(scope: SectionScope, sectionIds: string[]) {
    return this.db.channelSection.count({
      where: { ...owner(scope), id: { in: sectionIds } },
    });
  }

  /** Sets each section's position to its index in `sectionIds`. */
  async reorder(sectionIds: string[]) {
    await this.db.$transaction(
      sectionIds.map((id, position) =>
        this.db.channelSection.update({ where: { id }, data: { position } })
      )
    );
  }
}
