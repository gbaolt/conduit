'use client';

import type { Summary, SummaryBullet } from '@conduit/contract';
import { ORPCError } from '@orpc/client';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { client } from '@/lib/orpc';

/** What one summary covers: a thread, or a channel's or DM's log. */
export type SummaryTarget =
  | { kind: 'thread'; messageId: string }
  | { kind: 'channel'; roomId: string };

export type SummaryState =
  | { status: 'idle' }
  | { status: 'streaming'; messageCount: number; bullets: SummaryBullet[] }
  | { status: 'done'; summary: Summary }
  | { status: 'error'; code: string | null; message: string };

/** The span of a channel summary. Without `to` it runs until now. */
export type SummaryRange = { from: Date; to?: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Runs one summary at a time for `target` and keeps what the stream has said so far. */
export function useSummaryRun(target: SummaryTarget) {
  const [state, setState] = useState<SummaryState>({ status: 'idle' });
  const running = useRef<AbortController | null>(null);
  const lastRange = useRef<SummaryRange | undefined>(undefined);
  const id = target.kind === 'thread' ? target.messageId : target.roomId;

  const stop = useCallback(() => {
    running.current?.abort();
    running.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const summarize = useCallback(
    async (range?: SummaryRange) => {
      stop();
      lastRange.current = range;
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
            : await client.summaries.room(
                {
                  roomId: id,
                  from: (
                    range?.from ?? new Date(Date.now() - DAY_MS)
                  ).toISOString(),
                  to: range?.to?.toISOString(),
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
    retry: () => void summarize(lastRange.current),
    dismiss,
    share,
  };
}
