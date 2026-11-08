'use client';

import { addReaction, type Message, removeReaction } from '@conduit/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { client, orpc } from '@/lib/orpc';
import { sessionQuery } from '@/services/auth/queries';

import { awaitLiveTransaction, threadStreamKey } from './live';
import {
  cacheMessage,
  patchCachedMessage,
  pinnedQuery,
  savedQuery,
} from './queries';

/** A message the member sent that the server has not stored yet, or could not store. */
export type PendingMessage = {
  clientId: string;
  roomId: string;
  /** The root of the thread this reply goes to, or null for a message in the channel. */
  parentId: string | null;
  alsoSentToChannel: boolean;
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

/** The unsent messages of the channel's log, or of one thread when `parentId` is set. */
export function usePendingMessages(roomId: string, parentId?: string) {
  const all = useSyncExternalStore(
    subscribe,
    () => pending,
    () => pending
  );
  return useMemo(
    () =>
      all.filter(
        (message) =>
          message.roomId === roomId &&
          (parentId
            ? message.parentId === parentId
            : !message.parentId || message.alsoSentToChannel)
      ),
    [all, roomId, parentId]
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

/**
 * Sends optimistically: the row shows at once, keyed by `clientId`, and the stored message replaces it.
 * With `parentId` the message is a reply in that thread.
 */
export function useSendMessage(roomId: string, parentId?: string) {
  const queryClient = useQueryClient();

  const deliver = useCallback(
    async (message: PendingMessage) => {
      const { clientId, body, alsoSentToChannel } = message;
      patchPending(clientId, { status: 'sending' });
      try {
        const sent = await client.messages.send({
          roomId,
          clientId,
          body,
          parentId: message.parentId ?? undefined,
          alsoSentToChannel,
        });
        if (sent.txid) {
          await awaitLiveTransaction(
            message.parentId ? threadStreamKey(message.parentId) : roomId,
            sent.txid
          );
        }
        cacheMessage(queryClient, sent.message);
        removePending(clientId);
      } catch {
        patchPending(clientId, { status: 'failed' });
      }
    },
    [roomId, queryClient]
  );

  const send = useCallback(
    (body: string, alsoSentToChannel = false) => {
      const message: PendingMessage = {
        clientId: crypto.randomUUID(),
        roomId,
        parentId: parentId ?? null,
        alsoSentToChannel: Boolean(parentId) && alsoSentToChannel,
        body,
        createdAt: new Date(),
        status: 'sending',
      };
      setPending([...pending, message]);
      void deliver(message);
    },
    [roomId, parentId, deliver]
  );

  const retry = useCallback(
    (clientId: string) => {
      const message = pending.find((m) => m.clientId === clientId);
      if (message) void deliver(message);
    },
    [deliver]
  );

  return { send, retry, discard: removePending };
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.messages.edit.mutationOptions({
      onSuccess: (message) => cacheMessage(queryClient, message),
    })
  );
}

export function useDeleteMessage(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.messages.delete.mutationOptions({
      // Clears the row ahead of the live row that confirms it.
      onSuccess: (_, { messageId }) =>
        patchCachedMessage(queryClient, roomId, messageId, (message) => ({
          ...message,
          body: '',
          deletedAt: new Date(),
        })),
      onError: (error) => toast.error(error.message),
    })
  );
}

type ReactionChange = typeof addReaction | typeof removeReaction;

/** Adds the viewer's reaction or takes it back. The row changes at once, and the stored message replaces it. */
export function useToggleReaction(roomId: string) {
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQuery);
  const viewerId = session?.user.id;

  const mutationOptions = (change: ReactionChange) => ({
    onMutate: ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      let previous: Message | undefined;
      if (viewerId) {
        patchCachedMessage(queryClient, roomId, messageId, (message) => {
          previous ??= message;
          return {
            ...message,
            reactions:
              change(message.reactions, emoji, viewerId) ?? message.reactions,
          };
        });
      }
      return { previous };
    },
    onSuccess: (message: Message) => cacheMessage(queryClient, message),
    onError: (
      error: Error,
      { messageId }: { messageId: string },
      context: { previous: Message | undefined } | undefined
    ) => {
      const previous = context?.previous;
      if (previous) {
        patchCachedMessage(queryClient, roomId, messageId, () => previous);
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

export function useRemoveLinkPreview() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.messages.removeLinkPreview.mutationOptions({
      onSuccess: (message) => cacheMessage(queryClient, message),
      onError: (error) => toast.error(error.message),
    })
  );
}

/** Pins an unpinned message and unpins a pinned one. */
export function useTogglePin(roomId: string) {
  const queryClient = useQueryClient();

  const mutationOptions = {
    onSuccess: (message: Message) => {
      cacheMessage(queryClient, message);
      return queryClient.invalidateQueries({
        queryKey: pinnedQuery(roomId).queryKey,
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
