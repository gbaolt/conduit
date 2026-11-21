import type { Prisma } from '@generated/prisma/client';

import type { SearchSyncKind } from '@/search/domain/search-sync.repository';

/**
 * Asks the drain to bring each target's documents in line with Postgres. Call it inside the transaction of the
 * change. A row that exists is made due now, so a later change is never hidden behind an earlier lease.
 */
export async function markForSearch(
  tx: Prisma.TransactionClient,
  roomId: string,
  targets: { kind: SearchSyncKind; targetId: string }[]
) {
  if (targets.length === 0) return;
  const kinds = targets.map((target) => target.kind.toUpperCase());
  const ids = targets.map((target) => target.targetId);
  await tx.$executeRaw`
    INSERT INTO "SearchSync" ("kind", "targetId", "organizationId", "dueAt", "attempts")
    SELECT t.kind::"SearchSyncKind", t.target, c."organizationId", now(), 0
    FROM unnest(${kinds}::text[], ${ids}::text[]) AS t(kind, target), "Channel" c
    WHERE c.id = ${roomId}
    ON CONFLICT ("kind", "targetId")
    DO UPDATE SET "dueAt" = now(), "attempts" = 0, "lastError" = NULL`;
}
