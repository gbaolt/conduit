'use client';

import {
  type LiveStream,
  type Message,
  MessageSchema,
} from '@conduit/contract';
import {
  createRealtimeClient,
  type MaterializedLiveQuerySubscription,
  pgTypeOids,
  QueryRefreshController,
  type RealtimeClient,
  type SealedLiveQuery,
} from '@neon/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useState } from 'react';
import type { ZodType } from 'zod';

import { client } from '@/lib/orpc';

import { cacheMessage, pinnedIsStale, pinnedQuery } from './queries';

type LiveRow = Record<string, unknown>;
type LiveSubscription = MaterializedLiveQuerySubscription<LiveRow>;

/** `since` starts this far before the page load, so a skewed clock cannot drop a change. Rows seen twice are merged by id. */
const SINCE_MARGIN_MS = 5 * 60 * 1000;
const AWAIT_TXID_MS = 5000;

export type LiveStatus = 'connecting' | 'live' | 'offline';

// Prisma stores `timestamp(3)` in UTC, and the client would otherwise read the text in the browser's zone.
export const utcTimestamp = (value: string) =>
  new Date(`${value.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')}Z`);

const realtimeClients = new Map<string, RealtimeClient>();

function realtimeClient(url: string) {
  let existing = realtimeClients.get(url);
  if (!existing) {
    existing = createRealtimeClient({
      url,
      parsers: { [pgTypeOids.timestamp]: utcTimestamp },
    });
    realtimeClients.set(url, existing);
  }
  return existing;
}

/** Open streams by key: a channel's id, or `threadStreamKey` for a thread. */
const subscriptions = new Map<string, LiveSubscription>();

export const threadStreamKey = (parentId: string) => `thread:${parentId}`;

/** Resolves once the open stream has applied the transaction. Resolves at once when no stream is live. */
export async function awaitLiveTransaction(streamKey: string, txid: string) {
  const subscription = subscriptions.get(streamKey);
  if (subscription?.getState().status !== 'live') return;
  await subscription.awaitTxId(txid, AWAIT_TXID_MS).catch(() => undefined);
}

function toMessages(rows: readonly LiveRow[]) {
  const messages: Message[] = [];
  for (const row of rows) {
    const parsed = MessageSchema.safeParse(row);
    if (parsed.success) messages.push(parsed.data);
  }
  return messages;
}

const retryDelay = (attempt: number) => Math.min(30_000, 1000 * 2 ** attempt);

type OpenOptions = {
  stream: LiveStream;
  onStatus: (status: LiveStatus) => void;
  /** Every row the query returns now, and again after each change. */
  onRows: (rows: readonly LiveRow[]) => void;
  /** The open subscription, and null once it closes. */
  onSubscription?: (subscription: LiveSubscription | null) => void;
};

/**
 * The one place realtime enters the client. Seals the stream, subscribes, renews the capability
 * before it expires, and reconnects with backoff. Returns the function that stops it.
 * Without Realtime configured the status stays `offline`.
 */
function openLiveStream({
  stream,
  onStatus,
  onRows,
  onSubscription,
}: OpenOptions) {
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let teardown: (() => void) | undefined;

  const seal = async (): Promise<SealedLiveQuery<LiveRow> & { url: string }> =>
    client.realtime.seal({ stream });

  const connect = async (attempt: number) => {
    const retry = () => {
      teardown?.();
      teardown = undefined;
      onStatus('offline');
      retryTimer = setTimeout(
        () => void connect(attempt + 1),
        retryDelay(attempt)
      );
    };

    let sealed: Awaited<ReturnType<typeof seal>>;
    try {
      sealed = await seal();
    } catch {
      if (!stopped) retry();
      return;
    }
    if (stopped) return;

    const subscription = realtimeClient(sealed.url).subscribe<LiveRow>(sealed);
    const controller = new QueryRefreshController<LiveRow>({
      query: sealed,
      refreshQuery: seal,
      renewSubscription: (next) => subscription.renew(next),
      onRefreshExhausted: retry,
    });
    controller.setSubscription(subscription);
    controller.start();
    onSubscription?.(subscription);

    const stopListening = subscription.onChange((snapshot) => {
      if (snapshot.status === 'error') {
        retry();
        return;
      }
      onStatus(snapshot.status === 'live' ? 'live' : 'connecting');
      if (snapshot.data) onRows(snapshot.data);
    });

    teardown = () => {
      stopListening();
      controller.stop();
      subscription.unsubscribe();
      onSubscription?.(null);
    };
  };

  void connect(0);

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    teardown?.();
  };
}

/**
 * The conversation stream, or the thread stream when `parentId` is set. Writes each change into the
 * cached message pages. History and sending still work while the status is `offline`.
 */
export function useLiveStream(roomId: string, parentId?: string): LiveStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    const since = new Date(Date.now() - SINCE_MARGIN_MS);
    const streamKey = parentId ? threadStreamKey(parentId) : roomId;

    return openLiveStream({
      stream: parentId
        ? { kind: 'thread', roomId, parentId, since }
        : { kind: 'conversation', roomId, since },
      onStatus: setStatus,
      onRows: (rows) => {
        const messages = toMessages(rows);
        for (const message of messages) cacheMessage(queryClient, message);
        const pinnedKey = pinnedQuery(roomId).queryKey;
        if (pinnedIsStale(queryClient.getQueryData(pinnedKey), messages)) {
          void queryClient.invalidateQueries({ queryKey: pinnedKey });
        }
      },
      onSubscription: (subscription) => {
        if (subscription) subscriptions.set(streamKey, subscription);
        else if (subscriptions.get(streamKey)) subscriptions.delete(streamKey);
      },
    });
  }, [roomId, parentId, queryClient]);

  return status;
}

/** A stream that needs nothing from the client but which conversation it is about. */
export type LiveStreamSpec =
  | { kind: 'sidebar' }
  | { kind: 'presence' }
  | { kind: 'feed' }
  | { kind: 'typing'; roomId: string };

/**
 * Any stream other than the conversation. `onRows` gets the rows that match `schema`,
 * as the full current result each time. Pass `null` to stay closed, such as before a workspace is active.
 */
export function useLiveRows<Row>(
  spec: LiveStreamSpec | null,
  schema: ZodType<Row>,
  onRows: (rows: Row[]) => void
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const key = spec ? JSON.stringify(spec) : null;
  const handleRows = useEffectEvent((rows: readonly LiveRow[]) => {
    const parsed: Row[] = [];
    for (const row of rows) {
      const result = schema.safeParse(row);
      if (result.success) parsed.push(result.data);
    }
    onRows(parsed);
  });

  useEffect(() => {
    if (!key) return;
    const parsedSpec = JSON.parse(key) as LiveStreamSpec;
    const stream: LiveStream =
      parsedSpec.kind === 'typing'
        ? { ...parsedSpec, since: new Date(Date.now() - SINCE_MARGIN_MS) }
        : parsedSpec;

    return openLiveStream({
      stream,
      onStatus: setStatus,
      onRows: (rows) => handleRows(rows),
    });
  }, [key]);

  return status;
}
