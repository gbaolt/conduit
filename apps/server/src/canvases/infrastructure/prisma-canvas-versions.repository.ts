import type { CanvasVersionTrigger } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';
import type { CanvasVersionTrigger as CanvasVersionTriggerRow } from '@generated/prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import {
  type CanvasVersionsRepository,
  type LatestCanvasVersion,
  type NewCanvasVersion,
  SAFETY_VERSION_LABEL,
} from '@/canvases/domain/canvas-versions.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

type Tx = Prisma.TransactionClient;

const summarySelect = {
  id: true,
  canvasId: true,
  label: true,
  trigger: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true } },
} satisfies Prisma.CanvasVersionSelect;

const versionSelect = {
  ...summarySelect,
  snapshotJson: true,
  markdown: true,
  contentHash: true,
} satisfies Prisma.CanvasVersionSelect;

type SummaryRow = Prisma.CanvasVersionGetPayload<{
  select: typeof summarySelect;
}>;

const toTrigger = (trigger: CanvasVersionTriggerRow) =>
  trigger.toLowerCase() as CanvasVersionTrigger;
const fromTrigger = (trigger: CanvasVersionTrigger) =>
  trigger.toUpperCase() as CanvasVersionTriggerRow;

const toSummary = (row: SummaryRow) => ({
  ...row,
  trigger: toTrigger(row.trigger),
});

function insert(tx: Tx, version: NewCanvasVersion) {
  return tx.canvasVersion
    .create({
      data: {
        ...version,
        trigger: fromTrigger(version.trigger),
        snapshotJson: version.snapshotJson as Prisma.InputJsonValue,
      },
      select: summarySelect,
    })
    .then(toSummary);
}

/** Locks the canvas row, so version writes on one canvas run one at a time, and reads its newest version. */
async function lockLatest(
  tx: Tx,
  canvasId: string
): Promise<LatestCanvasVersion | null> {
  await tx.$queryRaw`SELECT id FROM "Canvas" WHERE id = ${canvasId} FOR UPDATE`;
  return tx.canvasVersion.findFirst({
    where: { canvasId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { contentHash: true, createdAt: true },
  });
}

/** Canvas version rows. Returns contract types, so no Prisma row leaves this file. */
@Injectable()
export class PrismaCanvasVersionsRepository implements CanvasVersionsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(canvasId: string, page: { cursor?: string; limit: number }) {
    let after: Prisma.CanvasVersionWhereInput = {};
    if (page.cursor) {
      const cursor = await this.db.canvasVersion.findFirst({
        where: { id: page.cursor, canvasId },
        select: { id: true, createdAt: true },
      });
      if (!cursor) return null;
      // Keyset on (createdAt, id), so versions saved in the same millisecond are neither skipped nor repeated.
      after = {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      };
    }
    const rows = await this.db.canvasVersion.findMany({
      where: { canvasId, ...after },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      select: summarySelect,
    });
    const items = rows.slice(0, page.limit).map(toSummary);
    return {
      items,
      nextCursor: rows.length > page.limit ? items.at(-1)!.id : null,
    };
  }

  async find(canvasId: string, versionId: string) {
    const row = await this.db.canvasVersion.findFirst({
      where: { id: versionId, canvasId },
      select: versionSelect,
    });
    return (
      row && {
        ...toSummary(row),
        snapshotJson: row.snapshotJson as Record<string, unknown>,
        markdown: row.markdown,
        contentHash: row.contentHash,
      }
    );
  }

  create(version: NewCanvasVersion) {
    return insert(this.db, version);
  }

  createIfDue(
    version: NewCanvasVersion,
    due: (latest: LatestCanvasVersion | null) => boolean
  ) {
    return this.db.$transaction(async (tx) =>
      due(await lockLatest(tx, version.canvasId)) ? insert(tx, version) : null
    );
  }

  restore({
    target,
    organizationId,
    authorId,
    label,
    current,
  }: Parameters<CanvasVersionsRepository['restore']>[0]) {
    const base = { canvasId: target.canvasId, organizationId, authorId };
    return this.db.$transaction(async (tx) => {
      const latest = await lockLatest(tx, target.canvasId);
      const safetyVersion =
        current && current.contentHash !== latest?.contentHash
          ? await insert(tx, {
              ...base,
              ...current,
              label: SAFETY_VERSION_LABEL,
              trigger: 'restore',
            })
          : null;
      const content = {
        snapshotJson: target.snapshotJson,
        markdown: target.markdown,
        contentHash: target.contentHash,
      };
      await tx.canvas.update({
        where: { id: target.canvasId },
        data: {
          ...content,
          snapshotJson: content.snapshotJson as Prisma.InputJsonValue,
          updatedById: authorId,
        },
      });
      const restoredVersion = await insert(tx, {
        ...base,
        ...content,
        label,
        trigger: 'restore',
      });
      return { restoredVersion, safetyVersion };
    });
  }
}
