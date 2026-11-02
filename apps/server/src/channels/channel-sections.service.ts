import { channelSectionErrors } from '@conduit/contract';
import { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ORPCError } from '@orpc/server';

import { prisma } from '@/database/prisma.service';

export type SectionViewer = { userId: string; organizationId: string };

function sectionError(code: keyof typeof channelSectionErrors) {
  return new ORPCError(code, channelSectionErrors[code]);
}

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

/** Every method is scoped to the viewer's own sections in the active workspace. */
@Injectable()
export class ChannelSectionsService {
  list(viewer: SectionViewer) {
    return prisma.channelSection.findMany({
      where: viewer,
      select,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(viewer: SectionViewer, name: string) {
    const last = await prisma.channelSection.aggregate({
      where: viewer,
      _max: { position: true },
    });
    return prisma.channelSection
      .create({
        data: { ...viewer, name, position: (last._max.position ?? -1) + 1 },
        select,
      })
      .catch(rethrowNameTaken);
  }

  async rename(viewer: SectionViewer, sectionId: string, name: string) {
    await this.own(viewer, sectionId);
    return prisma.channelSection
      .update({ where: { id: sectionId }, data: { name }, select })
      .catch(rethrowNameTaken);
  }

  /** The section's channels fall back to Channels through `onDelete: SetNull`. */
  async delete(viewer: SectionViewer, sectionId: string) {
    await this.own(viewer, sectionId);
    await prisma.channelSection.delete({ where: { id: sectionId } });
  }

  async reorder(viewer: SectionViewer, sectionIds: string[]) {
    const ids = [...new Set(sectionIds)];
    const owned = await prisma.channelSection.count({
      where: { ...viewer, id: { in: ids } },
    });
    if (owned !== ids.length) {
      throw sectionError('NOT_FOUND');
    }
    await prisma.$transaction(
      ids.map((id, position) =>
        prisma.channelSection.update({ where: { id }, data: { position } })
      )
    );
  }

  private async own(viewer: SectionViewer, sectionId: string) {
    const section = await prisma.channelSection.findFirst({
      where: { ...viewer, id: sectionId },
      select: { id: true },
    });
    if (!section) {
      throw sectionError('NOT_FOUND');
    }
  }
}
