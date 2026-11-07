'use client';

import { addReaction, type Message, removeReaction } from '@conduit/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { client, orpc } from '@/lib/orpc';
import { sessionQuery } from '@/services/auth/queries';

import { awaitLiveTransaction } from './live';
import {
  mapMessage,
  markDeleted,
  messagesQuery,
  pinnedQuery,
  savedQuery,
  upsertMessages,
} from './queries';

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

type ReactionChange = typeof addReaction | typeof removeReaction;

/** Adds the viewer's reaction or takes it back. The row changes at once, and the stored message replaces it. */
export function useToggleReaction(channelId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQuery);
  const viewerId = session?.user.id;
  const queryKey = messagesQuery(channelId).queryKey;

  const mutationOptions = (change: ReactionChange) => ({
    onMutate: ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const previous = queryClient
        .getQueryData(queryKey)
        ?.pages.flatMap((page) => page.messages)
        .find((message) => message.id === messageId);
      if (viewerId) {
        queryClient.setQueryData(queryKey, (data) =>
          mapMessage(data, messageId, (message) => ({
            ...message,
            reactions:
              change(message.reactions, emoji, viewerId) ?? message.reactions,
          }))
        );
      }
      return { previous };
    },
    onSuccess: (message: Message) =>
      queryClient.setQueryData(queryKey, (data) =>
        upsertMessages(data, [message])
      ),
    onError: (
      error: Error,
      { messageId }: { messageId: string },
      context: { previous: Message | undefined } | undefined
    ) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData(queryKey, (data) =>
          mapMessage(data, messageId, () => previous)
        );
      }
      toast.error(error.message);
    },
  });

  const react = useMutation(
    orpc.messages.react.mutationOptions(mutationOptions(addReaction))
  );
  const unreact = useMutation(
    orpc.messages.unreact.mutationOptions(mutationOptions(removeReaction))
  );

  return useCallback(
    (message: Pick<Message, 'id' | 'reactions'>, emoji: string) => {
      const reacted = viewerId && message.reactions[emoji]?.includes(viewerId);
      (reacted ? unreact : react).mutate({ messageId: message.id, emoji });
    },
    [viewerId, react, unreact]
  );
}

export function useRemoveLinkPreview(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = messagesQuery(channelId).queryKey;

  return useMutation(
    orpc.messages.removeLinkPreview.mutationOptions({
      onSuccess: (message) =>
        queryClient.setQueryData(queryKey, (data) =>
          upsertMessages(data, [message])
        ),
      onError: (error) => toast.error(error.message),
    })
  );
}

/** Pins an unpinned message and unpins a pinned one. */
export function useTogglePin(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = messagesQuery(channelId).queryKey;

  const mutationOptions = {
    onSuccess: (message: Message) => {
      queryClient.setQueryData(queryKey, (data) =>
        upsertMessages(data, [message])
      );
      return queryClient.invalidateQueries({
        queryKey: pinnedQuery(channelId).queryKey,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  };
  const pin = useMutation(orpc.messages.pin.mutationOptions(mutationOptions));
  const unpin = useMutation(
    orpc.messages.unpin.mutationOptions(mutationOptions)
  );

  return useCallback(
    (message: Pick<Message, 'id' | 'pinnedAt'>) =>
      (message.pinnedAt ? unpin : pin).mutate({ messageId: message.id }),
    [pin, unpin]
  );
}

/** Whether the viewer saved the message, and a toggle. The star follows the click before the list refetches. */
export function useSavedMessage(messageId: string) {
  const queryClient = useQueryClient();
  const { data: isSaved = false } = useQuery({
    ...savedQuery,
    select: (items) => items.some((item) => item.message.id === messageId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: savedQuery.queryKey });
  const onError = (error: Error) => toast.error(error.message);

  const add = useMutation(
    orpc.saved.add.mutationOptions({ onSuccess: refresh, onError })
  );
  const remove = useMutation(
    orpc.saved.remove.mutationOptions({ onSuccess: refresh, onError })
  );

  const saved = add.isPending || (isSaved && !remove.isPending);
  return {
    saved,
    toggle: () => (saved ? remove : add).mutate({ messageId }),
  };
}
