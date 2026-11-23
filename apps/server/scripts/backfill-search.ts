/**
 * Queues every live message and sent file for the search index, then drains the queue.
 *
 *   pnpm --filter server db:backfill-search          prints what it would queue
 *   pnpm --filter server db:backfill-search --yes    queues and drains
 *
 * Writes `SearchSync` rows to DATABASE_URL and documents to Upstash. A row that exists is left alone, so it can be
 * stopped and rerun. Every document is one billed Upstash request, and the free plan stops at 10,000 a day.
 */
import '@/load-env';
import 'reflect-metadata';

import { prisma } from '@/infrastructure/database/prisma.service';
import { SearchSyncService } from '@/search/application/search-sync.service';
import { PrismaSearchSyncRepository } from '@/search/infrastructure/prisma-search-sync.repository';
import { StorageFileText } from '@/search/infrastructure/storage-file-text';
import { UpstashSearchIndex } from '@/search/infrastructure/upstash-search-index';
import { S3ObjectStorage } from '@/storage/infrastructure/s3-object-storage';

const PAGE = 1000;

const [messages, files] = await Promise.all([
  prisma.message.count({ where: { deletedAt: null } }),
  prisma.file.count({
    where: { status: 'READY', deletedAt: null, messageId: { not: null } },
  }),
]);
console.log(`${messages} messages and ${files} files to index`);
if (!process.argv.includes('--yes')) {
  console.log('Rerun with --yes to queue and drain them.');
  await prisma.$disconnect();
  process.exit(0);
}

let queued = 0;
for (const [kind, table, where] of [
  ['MESSAGE', 'Message', `"deletedAt" IS NULL`],
  [
    'FILE',
    'File',
    `"status" = 'READY' AND "deletedAt" IS NULL AND "messageId" IS NOT NULL`,
  ],
] as const) {
  let after = '';
  for (;;) {
    // The table and filter are the constants above, never input.
    const page = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${table}" WHERE ${where} AND id > $1 ORDER BY id LIMIT ${PAGE}`,
      after
    );
    if (page.length === 0) break;
    queued += await prisma.$executeRawUnsafe(
      `INSERT INTO "SearchSync" ("kind", "targetId", "organizationId", "dueAt")
       SELECT '${kind}', t.id, c."organizationId", now()
       FROM "${table}" t JOIN "Channel" c ON c.id = t."channelId"
       WHERE t.id = ANY($1::text[])
       ON CONFLICT ("kind", "targetId") DO NOTHING`,
      page.map((row) => row.id)
    );
    after = page.at(-1)!.id;
  }
}
console.log(`queued ${queued} rows`);

const sync = new SearchSyncService(
  new PrismaSearchSyncRepository(prisma),
  new UpstashSearchIndex(),
  new StorageFileText(new S3ObjectStorage())
);
let synced = 0;
for (;;) {
  const drained = await sync.drain();
  synced += drained.synced;
  if (drained.claimed === 0) break;
  if (drained.synced === 0) {
    console.log('Every claimed row failed. Check lastError in SearchSync.');
    break;
  }
}
console.log(`synced ${synced} rows`);
await prisma.$disconnect();
