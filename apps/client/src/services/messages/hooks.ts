'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { client, orpc } from '@/lib/orpc';

import { awaitLiveTransaction } from './live';
import { markDeleted, messagesQuery, upsertMessages } from './queries';

/** A message the member sent that the server has not stored yet, or could not store. */
export type PendingMessage = {
  clientId: string;
  channelId: string;
  body: string;
  createdAt: Date;
  status: 'sending' | 'failed';
};

// Kept outside React so a failed message survives leaving the channel and coming back.
let pending: readonly PendingMessage[] = [];
const listeners = new Set<() => void>();

function setPending(next: readonly PendingMessage[]) {
  pending = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function usePendingMessages(channelId: string) {
  const all = useSyncExternalStore(
    subscribe,
    () => pending,
    () => pending
  );
  return useMemo(
    () => all.filter((message) => message.channelId === channelId),
    [all, channelId]
  );
}

const patchPending = (clientId: string, patch: Partial<PendingMessage>) =>
  setPending(
    pending.map((message) =>
      message.clientId === clientId ? { ...message, ...patch } : message
    )
  );

const removePending = (clientId: string) =>
  setPending(pending.filter((message) => message.clientId !== clientId));

/** Sends optimistically: the row shows at once, keyed by `clientId`, and the stored message replaces it. */
export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = messagesQuery(channelId).queryKey;

  const deliver = useCallback(
    async (clientId: string, body: string) => {
      patchPending(clientId, { status: 'sending' });
      try {
        const { message, txid } = await client.messages.send({
          channelId,
          clientId,
          body,
        });
        if (txid) await awaitLiveTransaction(channelId, txid);
        queryClient.setQueryData(queryKey, (data) =>
          upsertMessages(data, [message])
        );
        removePending(clientId);
      } catch {
        patchPending(clientId, { status: 'failed' });
      }
    },
    [channelId, queryClient, queryKey]
  );

  const send = useCallback(
    (body: string) => {
      const clientId = crypto.randomUUID();
      setPending([
        ...pending,
        { clientId, channelId, body, createdAt: new Date(), status: 'sending' },
      ]);
      void deliver(clientId, body);
    },
    [channelId, deliver]
  );

  const retry = useCallback(
    (clientId: string) => {
      const message = pending.find((m) => m.clientId === clientId);
      if (message) void deliver(clientId, message.body);
    },
    [deliver]
  );

  return { send, retry, discard: removePending };
}

export function useEditMessage(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = messagesQuery(channelId).queryKey;

  return useMutation(
    orpc.messages.edit.mutationOptions({
      onSuccess: (message) =>
        queryClient.setQueryData(queryKey, (data) =>
          upsertMessages(data, [message])
        ),
    })
  );
}

export function useDeleteMessage(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = messagesQuery(channelId).queryKey;

  return useMutation(
    orpc.messages.delete.mutationOptions({
      onSuccess: (_, { messageId }) =>
        queryClient.setQueryData(queryKey, (data) =>
          markDeleted(data, messageId, new Date())
        ),
      onError: (error) => toast.error(error.message),
    })
  );
}
