import { Prisma } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';

import { sectionError } from './channel-errors';

/** One user's sections in one workspace. Sections are private to their owner. */
export type SectionScope = { userId: string; organizationId: string };

const select = { id: true, name: true, position: true } as const;

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
export class ChannelSectionsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  list(scope: SectionScope) {
    return this.db.channelSection.findMany({
      where: scope,
      select,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Appends the section after the scope's last one. */
  async create(scope: SectionScope, name: string) {
    const last = await this.db.channelSection.aggregate({
      where: scope,
      _max: { position: true },
    });
    return this.db.channelSection
      .create({
        data: { ...scope, name, position: (last._max.position ?? -1) + 1 },
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
      where: { ...scope, id: sectionId },
      select: { id: true },
    });
    return section !== null;
  }

  /** How many of `sectionIds` the scope owns. */
  count(scope: SectionScope, sectionIds: string[]) {
    return this.db.channelSection.count({
      where: { ...scope, id: { in: sectionIds } },
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
