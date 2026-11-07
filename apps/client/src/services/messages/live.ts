'use client';

import { type Message, MessageSchema } from '@conduit/contract';
import {
  createRealtimeClient,
  type MaterializedLiveQuerySubscription,
  pgTypeOids,
  QueryRefreshController,
  type RealtimeClient,
  type SealedLiveQuery,
} from '@neon/realtime/client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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

/**
 * The one place realtime enters the client. Seals the conversation stream, or the thread stream when
 * `parentId` is set, subscribes, renews the capability before it expires, and writes each change into the
 * cached message pages. Without Realtime configured the status stays `offline`, and history and sending still work.
 */
export function useLiveStream(
  channelId: string,
  parentId?: string
): LiveStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    const since = new Date(Date.now() - SINCE_MARGIN_MS);
    const streamKey = parentId ? threadStreamKey(parentId) : channelId;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let teardown: (() => void) | undefined;

    const seal = async (): Promise<
      SealedLiveQuery<LiveRow> & { url: string }
    > => {
      const sealed = await client.realtime.seal({
        stream: parentId
          ? { kind: 'thread', channelId, parentId, since }
          : { kind: 'conversation', channelId, since },
      });
      return sealed;
    };

    const connect = async (attempt: number) => {
      const retry = () => {
        teardown?.();
        teardown = undefined;
        setStatus('offline');
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

      const subscription = realtimeClient(sealed.url).subscribe<LiveRow>(
        sealed
      );
      const controller = new QueryRefreshController<LiveRow>({
        query: sealed,
        refreshQuery: seal,
        renewSubscription: (next) => subscription.renew(next),
        onRefreshExhausted: retry,
      });
      controller.setSubscription(subscription);
      controller.start();
      subscriptions.set(streamKey, subscription);

      const stopListening = subscription.onChange((snapshot) => {
        if (snapshot.status === 'error') {
          retry();
          return;
        }
        setStatus(snapshot.status === 'live' ? 'live' : 'connecting');
        if (snapshot.data) {
          const messages = toMessages(snapshot.data);
          for (const message of messages) cacheMessage(queryClient, message);
          const pinnedKey = pinnedQuery(channelId).queryKey;
          if (pinnedIsStale(queryClient.getQueryData(pinnedKey), messages)) {
            void queryClient.invalidateQueries({ queryKey: pinnedKey });
          }
        }
      });

      teardown = () => {
        stopListening();
        controller.stop();
        subscription.unsubscribe();
        if (subscriptions.get(streamKey) === subscription) {
          subscriptions.delete(streamKey);
        }
      };
    };

    void connect(0);

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      teardown?.();
    };
  }, [channelId, parentId, queryClient]);

  return status;
}
