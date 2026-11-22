'use client';

import type { Answer, AnswerSource } from '@conduit/contract';
import { ORPCError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { client, orpc } from '@/lib/orpc';

import { askChatQuery, askChatsQuery } from './queries';

/** The question in flight, and what its stream has said so far. A stored answer replaces it once it settles. */
export type AskTurn = {
  question: string;
  found: boolean;
  body: string;
  sources: AnswerSource[];
} & (
  | { status: 'streaming' | 'stopped' }
  | { status: 'failed'; code: string | null; message: string }
);

/**
 * Asks one question at a time in a chat, and writes the stored answer into that chat's cache. The server stores
 * an answer even when the turn is stopped or cleared, so stopping only stops reading.
 */
export function useAskTurn(onAnswer: (answer: Answer) => void) {
  const queryClient = useQueryClient();
  const [turn, setTurn] = useState<AskTurn | null>(null);
  const running = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    running.current?.abort();
    running.current = null;
  }, []);
  useEffect(() => abort, [abort]);

  const stop = useCallback(() => {
    abort();
    setTurn((current) =>
      current?.status === 'streaming'
        ? { ...current, status: 'stopped' }
        : current
    );
    void queryClient.invalidateQueries({ queryKey: askChatsQuery.queryKey });
  }, [abort, queryClient]);

  const clear = useCallback(() => {
    abort();
    setTurn(null);
  }, [abort]);

  const send = useCallback(
    async (chatId: string | null, question: string) => {
      abort();
      const controller = new AbortController();
      running.current = controller;
      const asked = { question, found: true, body: '', sources: [] };
      setTurn({ ...asked, status: 'streaming' });

      try {
        const events = await client.ask.question(
          { chatId: chatId ?? undefined, question },
          { signal: controller.signal }
        );
        for await (const event of events) {
          if (event.type === 'partial') {
            const { found, body, sources } = event;
            setTurn({ question, found, body, sources, status: 'streaming' });
            continue;
          }
          const { answer } = event;
          const { queryKey } = askChatQuery(answer.chatId);
          queryClient.setQueryData(queryKey, (chat) =>
            chat
              ? { ...chat, answers: [...chat.answers, answer] }
              : { id: answer.chatId, title: question, answers: [answer] }
          );
          // A turn stopped earlier in this chat was stored too, and only a refetch brings it in.
          void queryClient.invalidateQueries({ queryKey });
          void queryClient.invalidateQueries({
            queryKey: askChatsQuery.queryKey,
          });
          setTurn(null);
          onAnswer(answer);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setTurn({
          ...asked,
          status: 'failed',
          code: error instanceof ORPCError ? error.code : null,
          message:
            error instanceof Error ? error.message : 'Something went wrong.',
        });
      } finally {
        if (running.current === controller) running.current = null;
      }
    },
    [abort, onAnswer, queryClient]
  );

  return { turn, send, stop, clear };
}

export function useDeleteAskChat() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.ask.deleteChat.mutationOptions({
      onSuccess: (_, { chatId }) => {
        queryClient.removeQueries({ queryKey: askChatQuery(chatId).queryKey });
        void queryClient.invalidateQueries({
          queryKey: askChatsQuery.queryKey,
        });
      },
    })
  );
}
