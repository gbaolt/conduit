'use client';

import type { Summary, SummaryBullet } from '@conduit/contract';
import { ORPCError } from '@orpc/client';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { client } from '@/lib/orpc';

/** What one summary covers: a thread, or a channel's or DM's log. */
export type SummaryTarget =
  | { kind: 'thread'; messageId: string }
  | { kind: 'channel'; channelId: string };

export type SummaryState =
  | { status: 'idle' }
  | { status: 'streaming'; messageCount: number; bullets: SummaryBullet[] }
  | { status: 'done'; summary: Summary }
  | { status: 'error'; code: string | null; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Runs one summary at a time for `target` and keeps what the stream has said so far. */
export function useSummaryRun(target: SummaryTarget) {
  const [state, setState] = useState<SummaryState>({ status: 'idle' });
  const running = useRef<AbortController | null>(null);
  const lastFrom = useRef<Date | undefined>(undefined);
  const id = target.kind === 'thread' ? target.messageId : target.channelId;

  const stop = useCallback(() => {
    running.current?.abort();
    running.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const summarize = useCallback(
    async (from?: Date) => {
      stop();
      lastFrom.current = from;
      const controller = new AbortController();
      running.current = controller;
      setState({ status: 'streaming', messageCount: 0, bullets: [] });

      try {
        const events =
          target.kind === 'thread'
            ? await client.summaries.thread(
                { messageId: id },
                { signal: controller.signal }
              )
            : await client.summaries.channel(
                {
                  channelId: id,
                  from: (from ?? new Date(Date.now() - DAY_MS)).toISOString(),
                },
                { signal: controller.signal }
              );

        for await (const event of events) {
          setState(
            event.type === 'partial'
              ? {
                  status: 'streaming',
                  messageCount: event.messageCount,
                  bullets: event.bullets,
                }
              : { status: 'done', summary: event.summary }
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          code: error instanceof ORPCError ? error.code : null,
          message:
            error instanceof Error ? error.message : 'Something went wrong.',
        });
      } finally {
        if (running.current === controller) running.current = null;
      }
    },
    [stop, target.kind, id]
  );

  const dismiss = useCallback(() => {
    stop();
    setState({ status: 'idle' });
  }, [stop]);

  const share = useMutation({
    mutationFn: (summaryId: string) => client.summaries.share({ summaryId }),
    // The shared message reaches the conversation through its live stream.
    onSuccess: dismiss,
  });

  return {
    state,
    summarize,
    retry: () => void summarize(lastFrom.current),
    dismiss,
    share,
  };
}
