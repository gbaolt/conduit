/**
 * Answers the open questions about Upstash Vector before search is built on it, one line per answer.
 *
 *   pnpm --filter server probe:search
 *
 * It writes 5,000 synthetic messages across 300 rooms to a namespace named `probe-<timestamp>`, then deletes the
 * namespace. It never reads or writes a workspace's namespace or the database. Needs UPSTASH_VECTOR_REST_URL and
 * UPSTASH_VECTOR_REST_TOKEN for a Hybrid index. About 5,300 billed requests, so run it once.
 */
import '@/load-env';

import { Index, QueryMode } from '@upstash/vector';

const DOCS = 5000;
const ROOMS = 300;
const NEEDLES = 30;
const LATENCY_RUNS = 200;
const FRESH_TIMEOUT_MS = 30_000;

const url = process.env.UPSTASH_VECTOR_REST_URL;
const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
if (!url || !token) {
  console.error('Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN.');
  process.exit(1);
}

type Metadata = { roomId: string; createdAt: number };
const namespaceName = `probe-${Date.now()}`;
const root = new Index<Metadata>({ url, token });
const space = root.namespace(namespaceName);
const room = (n: number) => `room-${n}`;
const inList = (count: number) =>
  `roomId IN (${Array.from({ length: count }, (_, n) => `'${room(n)}'`).join(', ')})`;
const words = ['launch', 'pricing', 'design', 'review', 'budget', 'hiring'];

const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]!;

try {
  const docs = Array.from({ length: DOCS }, (_, n) => ({
    id: `message:${n}`,
    data: `${words[n % words.length]} notes ${n} for the team`,
    metadata: { roomId: room(n % ROOMS), createdAt: n },
  }));
  // The needles are the only docs about "zeppelin", and all sit in one room.
  for (let n = 0; n < NEEDLES; n += 1) {
    docs[n * 7]!.data = `zeppelin maintenance checklist part ${n}`;
    docs[n * 7]!.metadata.roomId = 'needle-room';
  }
  for (let start = 0; start < docs.length; start += 1000) {
    await space.upsert(docs.slice(start, start + 1000));
  }
  console.log(`upserted ${DOCS} docs across ${ROOMS} rooms`);

  for (const count of [50, 300, 1000]) {
    try {
      await space.query({ data: 'launch', topK: 5, filter: inList(count) });
      console.log(`filter with ${count} room ids: works`);
    } catch (error) {
      console.log(`filter with ${count} room ids: fails (${String(error)})`);
    }
  }

  const needles = await space.query({
    data: 'zeppelin maintenance',
    topK: 20,
    filter: `roomId = 'needle-room'`,
  });
  console.log(
    `recall under a one-room filter: ${needles.length} of 20 (${Math.round((needles.length / 20) * 100)}%)`
  );

  const started = Date.now();
  await space.upsert({
    id: 'fresh',
    data: 'quokka sighting report',
    metadata: { roomId: 'fresh-room', createdAt: 0 },
  });
  let freshMs: number | null = null;
  while (Date.now() - started < FRESH_TIMEOUT_MS) {
    const hits = await space.query({
      data: 'quokka sighting',
      topK: 1,
      filter: `roomId = 'fresh-room'`,
      queryMode: QueryMode.SPARSE,
    });
    if (hits[0]?.id === 'fresh') {
      freshMs = Date.now() - started;
      break;
    }
  }
  console.log(
    `freshness: ${freshMs === null ? `not found within ${FRESH_TIMEOUT_MS} ms` : `${freshMs} ms from upsert to found`}`
  );

  for (const mode of [QueryMode.SPARSE, QueryMode.HYBRID]) {
    const hits = await space.query({
      data: 'pricing',
      topK: 3,
      queryMode: mode,
    });
    console.log(`query mode ${mode}: ${hits.length} hits`);
  }

  const latencies: number[] = [];
  for (let run = 0; run < LATENCY_RUNS; run += 1) {
    const start = performance.now();
    await space.query({
      data: words[run % words.length]!,
      topK: 20,
      filter: inList(50),
    });
    latencies.push(performance.now() - start);
  }
  console.log(
    `latency over ${LATENCY_RUNS} queries: p50 ${Math.round(percentile(latencies, 0.5))} ms, p95 ${Math.round(percentile(latencies, 0.95))} ms`
  );
} finally {
  // A run that failed before its first upsert never created the namespace.
  await root
    .deleteNamespace(namespaceName)
    .then(() => console.log(`deleted namespace ${namespaceName}`))
    .catch(() => undefined);
}
