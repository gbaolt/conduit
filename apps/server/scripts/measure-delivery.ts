/**
 * Measures how long a sent message takes to reach a live subscriber, API hop included.
 *
 *   API_URL=https://api.example.com CHANNEL_ID=... COOKIE='better-auth.session_token=...' \
 *     pnpm --filter server exec tsx scripts/measure-delivery.ts
 *
 * It posts COUNT messages (default 500) to the channel through `messages.send`, one every INTERVAL_MS
 * (default 200), and times each from just before the request to its arrival on the sealed conversation stream.
 * The sender must be a member of the channel, so the messages land in a real channel: use a throwaway one.
 * Exits 1 when p95 is 200 ms or more, or when any message never arrives.
 */
import { createRealtimeClient, pgTypeOids } from '@neon/realtime/client';

const apiUrl = required('API_URL').replace(/\/$/, '');
const roomId = required('CHANNEL_ID');
const cookie = required('COOKIE');
const count = Number(process.env.COUNT ?? 500);
const intervalMs = Number(process.env.INTERVAL_MS ?? 200);
const P95_LIMIT_MS = 200;
const ARRIVAL_GRACE_MS = 10_000;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `${path} failed with ${response.status}: ${await response.text()}`
    );
  }
  return (await response.json()) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted: number[], p: number) {
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
    ] ?? 0
  );
}

type Row = { clientId: string };

const sealed = await call<{
  capability: string;
  queryFingerprint: string;
  expiresAt: number;
  url: string;
}>('/realtime/seal', {
  stream: {
    kind: 'conversation',
    roomId,
    since: new Date(Date.now() - 60_000).toISOString(),
  },
});

const run = crypto.randomUUID();
const sentAt = new Map<string, number>();
const latencies: number[] = [];
const seen = new Set<string>();

const client = createRealtimeClient({
  url: sealed.url,
  parsers: {
    [pgTypeOids.timestamp]: (value: string) =>
      new Date(`${value.replace(' ', 'T')}Z`),
  },
});
const subscription = client.subscribe<Row>(sealed);
subscription.onChange(({ data }) => {
  const arrivedAt = Date.now();
  for (const row of data ?? []) {
    const start = sentAt.get(row.clientId);
    if (start !== undefined && !seen.has(row.clientId)) {
      seen.add(row.clientId);
      latencies.push(arrivedAt - start);
    }
  }
});

await subscription.awaitRows(() => true, 15_000);

for (let index = 0; index < count; index += 1) {
  const clientId = `${run}-${index}`;
  sentAt.set(clientId, Date.now());
  void call('/channels/' + roomId + '/messages', {
    roomId,
    clientId,
    body: `delivery probe ${index}`,
  }).catch((error: unknown) => console.error(error));
  await sleep(intervalMs);
}

const deadline = Date.now() + ARRIVAL_GRACE_MS;
while (seen.size < count && Date.now() < deadline) await sleep(100);

subscription.unsubscribe();
client.close();

const sorted = [...latencies].sort((a, b) => a - b);
const lost = count - seen.size;
const [p50, p95, p99] = [50, 95, 99].map((p) => percentile(sorted, p));
console.log(`sent ${count}, received ${seen.size}, lost ${lost}`);
console.log(`p50 ${p50} ms, p95 ${p95} ms, p99 ${p99} ms`);

if (lost > 0 || (p95 ?? Infinity) >= P95_LIMIT_MS) {
  console.error(
    `Failed: p95 must stay under ${P95_LIMIT_MS} ms with no lost message.`
  );
  process.exit(1);
}
